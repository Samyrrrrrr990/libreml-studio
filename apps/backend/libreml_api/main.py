"""Localhost-only FastAPI application for LibreML Studio."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from threading import Event
from typing import Annotated, Any, Literal, cast
from uuid import UUID, uuid4

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse
from libreml_core.artifacts import (
    ArtifactEnvelope,
    ReportArtifact,
    TrainedModelArtifact,
    artifact_preview,
    fingerprint_value,
)
from libreml_core.execution import WorkflowExecutionError
from libreml_core.graph import GraphValidator, stale_after_change, workflow_fingerprint
from libreml_core.persistence import ProjectNotFoundError, RevisionConflictError
from libreml_core.schemas import (
    ImportResponse,
    PredictionRequest,
    PredictionResponse,
    ProjectCreate,
    ProjectRecord,
    RepairDecision,
    RunRequest,
    RunResult,
    WorkflowGraph,
    WorkflowSaveResult,
)
from libreml_core.security import (
    DEFAULT_MAX_IMPORT_BYTES,
    ImportSecurityError,
    sanitize_filename,
)
from libreml_reporting.renderer import (
    REPORT_CONTENT_SECURITY_POLICY,
    finalize_report_provenance,
)
from pydantic import BaseModel, ConfigDict
from pydantic_core import PydanticUndefined
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .state import AppState, default_data_root

API_VERSION = "1.0"
SOURCE_EXTENSIONS: dict[str, set[str]] = {
    "csv": {".csv", ".tsv"},
    "excel": {".xlsx", ".xlsm"},
    "parquet": {".parquet", ".pq"},
}


class ErrorBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    error: dict[str, Any]


class RepairResult(BaseModel):
    applied: bool
    workflow: WorkflowGraph
    stale_node_ids: list[str]


class _ImportTooLargeError(ImportSecurityError):
    """An upload crossed the explicit local import byte budget."""


class _EmptyImportError(ImportSecurityError):
    """An upload contained no bytes."""


def _problem(
    code: str, message: str, *, details: Any = None, status_code: int = 400
) -> HTTPException:
    return HTTPException(
        status_code=status_code, detail={"code": code, "message": message, "details": details}
    )


def _node_default_config(model_type: type[BaseModel]) -> dict[str, Any]:
    defaults: dict[str, Any] = {}
    for name, field_info in model_type.model_fields.items():
        if field_info.default is not PydanticUndefined:
            defaults[name] = field_info.default
        elif field_info.default_factory is not None:
            defaults[name] = field_info.get_default(call_default_factory=True, validated_data={})
    return cast(dict[str, Any], json.loads(json.dumps(defaults, default=str)))


def create_app(*, data_root: Path | None = None, bundled_data_root: Path | None = None) -> FastAPI:
    app = FastAPI(
        title="LibreML Studio Local API",
        version=API_VERSION,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]", "testserver"]
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "tauri://localhost",
            "http://tauri.localhost",
        ],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Content-Type", "If-Match"],
    )
    state = AppState(data_root or default_data_root(), bundled_data_root)
    app.state.libreml = state

    allowed_origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    }

    @app.middleware("http")
    async def reject_cross_site_mutations(request: Request, call_next: Any) -> Any:
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            origin = request.headers.get("origin")
            if origin is not None and origin not in allowed_origins:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "untrusted_origin",
                            "message": "State-changing requests are accepted only from the local LibreML interface.",
                        }
                    },
                )
        return await call_next(request)

    @app.exception_handler(ProjectNotFoundError)
    async def project_missing(request: Request, exc: ProjectNotFoundError) -> JSONResponse:
        del request
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "project_not_found",
                    "message": "The requested project does not exist.",
                    "details": str(exc),
                }
            },
        )

    @app.exception_handler(RevisionConflictError)
    async def revision_conflict(request: Request, exc: RevisionConflictError) -> JSONResponse:
        del request
        return JSONResponse(
            status_code=409, content={"error": {"code": "revision_conflict", "message": str(exc)}}
        )

    @app.exception_handler(RequestValidationError)
    async def request_invalid(request: Request, exc: RequestValidationError) -> JSONResponse:
        del request
        safe_details = [
            {
                "location": list(error.get("loc", ())),
                "message": error.get("msg", "Invalid value"),
                "type": error.get("type", "validation_error"),
            }
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "invalid_request",
                    "message": "The request did not match the API schema.",
                    "details": safe_details,
                }
            },
        )

    @app.exception_handler(ImportSecurityError)
    async def unsafe_import(request: Request, exc: ImportSecurityError) -> JSONResponse:
        del request
        if isinstance(exc, _ImportTooLargeError):
            status_code = status.HTTP_413_CONTENT_TOO_LARGE
            code = "import_too_large"
            message = f"The upload exceeds the {DEFAULT_MAX_IMPORT_BYTES}-byte local import limit."
        elif isinstance(exc, _EmptyImportError):
            status_code = status.HTTP_400_BAD_REQUEST
            code = "empty_import"
            message = "The uploaded file is empty."
        else:
            status_code = status.HTTP_400_BAD_REQUEST
            code = "unsafe_import"
            message = "The import was rejected by the local file safety policy."
        return JSONResponse(
            status_code=status_code,
            content={"error": {"code": code, "message": message}},
        )

    @app.exception_handler(WorkflowExecutionError)
    async def execution_invalid(request: Request, exc: WorkflowExecutionError) -> JSONResponse:
        del request
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "workflow_execution_error",
                    "message": str(exc),
                    "details": [issue.model_dump(mode="json") for issue in exc.issues],
                }
            },
        )

    @app.get("/api/v1/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "version": API_VERSION,
            "local_only": True,
            "bind_host": "127.0.0.1",
            "storage": "sqlite",
            "telemetry": False,
        }

    @app.get("/api/v1/node-types")
    def node_types() -> dict[str, Any]:
        nodes = []
        for definition in state.registry.all():
            nodes.append(
                {
                    "type": definition.type,
                    "version": definition.version,
                    "display_name": definition.display_name,
                    "category": definition.category,
                    "description": definition.description,
                    "learning_explanation": definition.learning_explanation,
                    "research_explanation": definition.research_explanation,
                    "inputs": [port.model_dump(mode="json") for port in definition.inputs],
                    "outputs": [port.model_dump(mode="json") for port in definition.outputs],
                    "default_config": _node_default_config(definition.config_model),
                    "config_schema": definition.config_model.model_json_schema(),
                    "deterministic": definition.deterministic,
                    "cacheable": definition.cacheable,
                    "resource_hints": definition.resource_hints.model_dump(mode="json"),
                    "documentation_ref": definition.documentation_ref,
                }
            )
        return {"nodes": nodes}

    @app.get("/api/v1/examples")
    def examples() -> dict[str, Any]:
        datasets = []
        if state.bundled_data_root.exists():
            for path in sorted(state.bundled_data_root.glob("*.csv")):
                datasets.append(
                    {
                        "id": path.stem,
                        "name": path.stem.replace("_", " ").title(),
                        "description": "Bundled, synthetic educational dataset with no personal data.",
                        "download_url": f"/api/v1/examples/{path.stem}/download",
                        "license": "CC0-1.0",
                        "suggested_node_config": {
                            "type": "csv_import",
                            "version": "1.0.0",
                            "config": {"path": f"bundled:{path.name}"},
                        },
                    }
                )
        return {"datasets": datasets}

    @app.get("/api/v1/examples/{dataset_id}/download")
    def example_download(dataset_id: str) -> FileResponse:
        if not dataset_id.replace("_", "").replace("-", "").isalnum():
            raise _problem("invalid_dataset_id", "Invalid example dataset identifier")
        path = (state.bundled_data_root / f"{dataset_id}.csv").resolve()
        if not path.is_relative_to(state.bundled_data_root) or not path.is_file():
            raise _problem(
                "example_not_found", "The example dataset was not found", status_code=404
            )
        return FileResponse(path, media_type="text/csv", filename=path.name)

    @app.post("/api/v1/projects", response_model=ProjectRecord, status_code=status.HTTP_201_CREATED)
    def create_project(request: ProjectCreate) -> ProjectRecord:
        project = state.repository.create(request)
        project_dir = state.project_dir(project.id)
        (project_dir / "imports").mkdir(parents=True, exist_ok=True)
        return project

    @app.get("/api/v1/projects", response_model=list[ProjectRecord])
    def list_projects() -> list[ProjectRecord]:
        return state.repository.list_projects()

    @app.get("/api/v1/projects/{project_id}", response_model=ProjectRecord)
    def get_project(project_id: UUID) -> ProjectRecord:
        return state.repository.get(project_id)

    @app.put("/api/v1/projects/{project_id}/workflow", response_model=WorkflowSaveResult)
    def save_workflow(
        project_id: UUID,
        workflow: WorkflowGraph,
        expected_revision: int | None = Query(default=None, ge=1),
    ) -> WorkflowSaveResult:
        previous = state.repository.get(project_id)
        validation = GraphValidator(state.registry).validate(workflow)
        if not validation.valid:
            raise WorkflowExecutionError("Workflow validation failed", validation.issues)
        stale = sorted(stale_after_change(previous.workflow, workflow))
        project = state.repository.save_workflow(project_id, workflow, expected_revision)
        state.runtime(project_id).executor.artifacts.clear_latest(set(stale))
        return WorkflowSaveResult(project=project, validation=validation, stale_node_ids=stale)

    @app.post("/api/v1/projects/{project_id}/workflow/validate")
    def validate_workflow(project_id: UUID, workflow: WorkflowGraph) -> Any:
        state.repository.get(project_id)
        return GraphValidator(state.registry).validate(workflow)

    @app.post(
        "/api/v1/projects/{project_id}/imports",
        response_model=ImportResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def import_file(
        project_id: UUID,
        file: Annotated[UploadFile, File()],
        source_type: Annotated[Literal["csv", "excel", "parquet"], Form()],
    ) -> ImportResponse:
        state.repository.get(project_id)
        filename = sanitize_filename(file.filename or "")
        extension = Path(filename).suffix.lower()
        if extension not in SOURCE_EXTENSIONS[source_type]:
            raise ImportSecurityError("The filename extension does not match the import type")
        imports_dir = state.project_dir(project_id) / "imports"
        imports_dir.mkdir(parents=True, exist_ok=True)
        temporary = imports_dir / f".{uuid4().hex}.upload"
        digest = hashlib.sha256()
        total = 0
        try:
            with temporary.open("xb") as output:
                while chunk := await file.read(1024 * 1024):
                    total += len(chunk)
                    if total > DEFAULT_MAX_IMPORT_BYTES:
                        raise _ImportTooLargeError(
                            f"Upload exceeds the {DEFAULT_MAX_IMPORT_BYTES}-byte limit"
                        )
                    digest.update(chunk)
                    output.write(chunk)
            if total == 0:
                raise _EmptyImportError("The uploaded file is empty")
            destination = imports_dir / f"{digest.hexdigest()[:12]}-{filename}"
            temporary.replace(destination)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
        finally:
            await file.close()
        node_type = {"csv": "csv_import", "excel": "excel_import", "parquet": "parquet_import"}[
            source_type
        ]
        relative_path = str(destination.relative_to(state.project_dir(project_id)))
        config: dict[str, Any] = {"path": relative_path}
        if extension == ".tsv":
            config["delimiter"] = "\t"
        state.repository.append_audit(
            project_id,
            "data_import",
            f"Imported local file '{filename}'.",
            {
                "filename": filename,
                "relative_path": str(destination.relative_to(state.project_dir(project_id))),
                "size_bytes": total,
                "sha256": digest.hexdigest(),
                "source_type": source_type,
            },
        )
        return ImportResponse(
            relative_path=relative_path,
            size_bytes=total,
            sha256=digest.hexdigest(),
            suggested_node_config={"type": node_type, "version": "1.0.0", "config": config},
        )

    @app.post("/api/v1/projects/{project_id}/runs", response_model=RunResult)
    def run_workflow(project_id: UUID, request: RunRequest) -> RunResult:
        project = state.repository.get(project_id)
        graph = request.workflow or project.workflow
        runtime = state.runtime(project_id)
        run_id = request.run_id or uuid4()
        cancellation = Event()
        with runtime.lock:
            if run_id in runtime.cancellations or run_id in runtime.runs:
                raise _problem(
                    "duplicate_run_id", "This run identifier is already in use", status_code=409
                )
            runtime.cancellations[run_id] = cancellation
        graph_hash = workflow_fingerprint(graph)
        workflow_source: Literal["saved", "ad_hoc"] = (
            "ad_hoc" if request.workflow is not None else "saved"
        )
        state.repository.append_audit(
            project_id,
            "run_started",
            "Started workflow execution.",
            {
                "run_id": str(run_id),
                "random_seed": request.random_seed,
                "target_node_ids": request.target_node_ids,
                "workflow_hash": graph_hash,
                "project_revision": project.revision,
                "workflow_source": workflow_source,
            },
        )
        terminal_audit_written = False
        try:
            project_dir = state.project_dir(project_id)
            imports_dir = project_dir / "imports"
            imports_dir.mkdir(parents=True, exist_ok=True)
            with runtime.execution_lock:
                if workflow_source == "ad_hoc" and graph_hash != workflow_fingerprint(
                    project.workflow
                ):
                    runtime.executor.artifacts.clear_latest(
                        set(runtime.executor.artifacts.all_latest())
                    )
                result = runtime.executor.execute(
                    graph,
                    project_id=project_id,
                    project_dir=project_dir,
                    allowed_import_roots=[imports_dir, state.bundled_data_root],
                    target_node_ids=request.target_node_ids,
                    random_seed=request.random_seed,
                    cancellation=cancellation,
                    run_id=run_id,
                    audit=lambda event_type, narrative, payload: state.repository.append_audit(
                        project_id, event_type, narrative, payload
                    ),
                )
            result.workflow_hash = graph_hash
            result.project_revision = project.revision
            result.workflow_source = workflow_source
            for node in graph.nodes:
                if node.type != "generate_report":
                    continue
                envelope = runtime.executor.artifacts.get_latest(node.id, "report")
                if (
                    not isinstance(envelope, ArtifactEnvelope)
                    or not isinstance(envelope.value, ReportArtifact)
                    or envelope.run_id != result.run_id
                ):
                    continue
                finalized_report = finalize_report_provenance(
                    envelope.value,
                    project_dir=project_dir,
                    project_id=project_id,
                    project_title=project.title,
                    project_mode=project.mode.value,
                    project_revision=project.revision,
                    run_id=result.run_id,
                    workflow_hash=graph_hash,
                    workflow_source=workflow_source,
                )
                finalized_envelope = ArtifactEnvelope(
                    type=envelope.type,
                    value=finalized_report,
                    fingerprint=fingerprint_value(finalized_report),
                    run_id=envelope.run_id,
                    workflow_fingerprint=envelope.workflow_fingerprint,
                )
                node_outputs = runtime.executor.artifacts.get_latest(node.id)
                if not isinstance(node_outputs, dict):
                    raise RuntimeError("The generated report output could not be finalized")
                runtime.executor.artifacts.set_latest(
                    node.id, dict(node_outputs) | {"report": finalized_envelope}
                )
                for summary in result.artifacts:
                    if summary.node_id == node.id and summary.port == "report":
                        summary.fingerprint = finalized_envelope.fingerprint
                        summary.preview = artifact_preview(finalized_report)
            with runtime.lock:
                runtime.runs[result.run_id] = result
                for node_result in result.node_results:
                    for warning in node_result.warnings:
                        runtime.pending_warnings.setdefault(
                            (warning.code, node_result.node_id), []
                        ).append(warning)
            terminal_event = "run_failed" if result.status.value == "failed" else "run_finished"
            state.repository.append_audit(
                project_id,
                terminal_event,
                f"Workflow run finished with status {result.status.value}.",
                {
                    "run_id": str(result.run_id),
                    "status": result.status.value,
                    "warning_codes": [warning.code for warning in result.warnings],
                    "workflow_hash": graph_hash,
                    "project_revision": project.revision,
                    "workflow_source": workflow_source,
                },
            )
            terminal_audit_written = True
            return result
        except Exception as exc:
            if not terminal_audit_written:
                state.repository.append_audit(
                    project_id,
                    "run_failed",
                    "Workflow run failed before a terminal result could be returned.",
                    {
                        "run_id": str(run_id),
                        "status": "failed",
                        "failure_type": type(exc).__name__,
                        "workflow_hash": graph_hash,
                        "project_revision": project.revision,
                        "workflow_source": workflow_source,
                    },
                )
            raise
        finally:
            with runtime.lock:
                runtime.cancellations.pop(run_id, None)

    @app.get("/api/v1/projects/{project_id}/runs/{run_id}", response_model=RunResult)
    def get_run(project_id: UUID, run_id: UUID) -> RunResult:
        state.repository.get(project_id)
        result = state.runtime(project_id).runs.get(run_id)
        if result is None:
            raise _problem(
                "run_not_found", "The run is unavailable in this backend session", status_code=404
            )
        return result

    @app.post("/api/v1/projects/{project_id}/runs/{run_id}/cancel")
    def cancel_run(project_id: UUID, run_id: UUID) -> dict[str, Any]:
        state.repository.get(project_id)
        cancellation = state.runtime(project_id).cancellations.get(run_id)
        if cancellation is None:
            return {"accepted": False, "status": "not_running"}
        cancellation.set()
        state.repository.append_audit(
            project_id,
            "run_cancel_requested",
            "Requested cooperative cancellation.",
            {"run_id": str(run_id)},
        )
        return {"accepted": True, "status": "cancellation_requested"}

    @app.get("/api/v1/projects/{project_id}/results/{node_id}")
    def node_result(project_id: UUID, node_id: str) -> dict[str, Any]:
        project = state.repository.get(project_id)
        if node_id not in {node.id for node in project.workflow.nodes}:
            raise _problem(
                "result_not_found",
                "This node is not part of the saved project workflow",
                status_code=404,
            )
        outputs = state.runtime(project_id).executor.artifacts.get_latest(node_id)
        if not isinstance(outputs, dict):
            raise _problem(
                "result_not_found",
                "Run this node successfully before requesting its result",
                status_code=404,
            )
        expected_workflow = workflow_fingerprint(project.workflow)
        if any(envelope.workflow_fingerprint != expected_workflow for envelope in outputs.values()):
            raise _problem(
                "result_stale",
                "This result was not produced by the currently saved workflow",
                status_code=409,
            )
        return {
            "node_id": node_id,
            "outputs": {
                port: {
                    "type": envelope.type.value,
                    "fingerprint": envelope.fingerprint,
                    "preview": artifact_preview(envelope.value),
                }
                for port, envelope in outputs.items()
            },
        }

    @app.post(
        "/api/v1/projects/{project_id}/predictions/{trained_node_id}",
        response_model=PredictionResponse,
    )
    def predict(
        project_id: UUID, trained_node_id: str, request: PredictionRequest
    ) -> PredictionResponse:
        project = state.repository.get(project_id)
        saved_node = next(
            (node for node in project.workflow.nodes if node.id == trained_node_id), None
        )
        if saved_node is None or saved_node.type != "train_model":
            raise _problem(
                "trained_model_not_found",
                "The requested training node is not part of the saved workflow",
                status_code=404,
            )
        envelope = state.runtime(project_id).executor.artifacts.get_latest(
            trained_node_id, "trained_model"
        )
        if not isinstance(envelope, ArtifactEnvelope) or not isinstance(
            envelope.value, TrainedModelArtifact
        ):
            raise _problem(
                "trained_model_not_found",
                "Train the selected model in this backend session before predicting",
                status_code=404,
            )
        if envelope.workflow_fingerprint != workflow_fingerprint(project.workflow):
            raise _problem(
                "trained_model_stale",
                "Rerun the saved workflow before using interactive prediction",
                status_code=409,
            )
        trained = envelope.value
        frame = pd.DataFrame(request.rows)
        missing = set(trained.feature_columns) - set(frame.columns)
        extras = set(frame.columns) - set(trained.feature_columns)
        if missing or extras:
            raise _problem(
                "prediction_schema_mismatch",
                "Prediction fields do not match the fitted pipeline",
                details={"missing": sorted(missing), "unexpected": sorted(extras)},
                status_code=422,
            )
        for field in trained.feature_schema:
            if field["kind"] == "number":
                try:
                    frame[field["name"]] = pd.to_numeric(frame[field["name"]], errors="raise")
                except (ValueError, TypeError) as exc:
                    raise _problem(
                        "invalid_numeric_value",
                        f"'{field['name']}' requires numeric values",
                        status_code=422,
                    ) from exc
        predictions, probabilities, classes = trained.predict(frame)
        state.repository.append_audit(
            project_id,
            "interactive_prediction",
            f"Generated {len(predictions)} interactive prediction(s).",
            {
                "trained_node_id": trained_node_id,
                "row_count": len(predictions),
                "input_values_recorded": False,
            },
        )
        return PredictionResponse(
            predictions=predictions, probabilities=probabilities, classes=classes
        )

    @app.get("/api/v1/projects/{project_id}/reports/{report_node_id}")
    def report(
        project_id: UUID,
        report_node_id: str,
        format: Literal["html", "markdown", "json"] = Query(default="html"),
    ) -> Any:
        project = state.repository.get(project_id)
        saved_node = next(
            (node for node in project.workflow.nodes if node.id == report_node_id), None
        )
        if saved_node is None or saved_node.type != "generate_report":
            raise _problem(
                "report_not_found",
                "The requested report node is not part of the saved workflow",
                status_code=404,
            )
        envelope = state.runtime(project_id).executor.artifacts.get_latest(report_node_id, "report")
        if not isinstance(envelope, ArtifactEnvelope) or not isinstance(
            envelope.value, ReportArtifact
        ):
            raise _problem(
                "report_not_found",
                "Generate the report in this backend session first",
                status_code=404,
            )
        if envelope.workflow_fingerprint != workflow_fingerprint(project.workflow):
            raise _problem(
                "report_stale",
                "Rerun the saved workflow before viewing this report",
                status_code=409,
            )
        artifact = envelope.value
        state.repository.append_audit(
            project_id,
            "report_viewed",
            f"Viewed generated report as {format}.",
            {"report_node_id": report_node_id, "format": format},
        )
        if format == "html":
            return HTMLResponse(
                artifact.html,
                headers={
                    "Content-Security-Policy": REPORT_CONTENT_SECURITY_POLICY,
                    "X-Content-Type-Options": "nosniff",
                    "Referrer-Policy": "no-referrer",
                    "X-Frame-Options": "DENY",
                    "Cache-Control": "no-store",
                },
            )
        if format == "markdown":
            return PlainTextResponse(artifact.markdown, media_type="text/markdown")
        return JSONResponse(artifact.json_report)

    @app.get("/api/v1/projects/{project_id}/audit")
    def audit(project_id: UUID) -> dict[str, Any]:
        return {
            "events": state.repository.audit_events(project_id),
            "integrity": state.repository.verify_audit(project_id),
        }

    @app.get("/api/v1/projects/{project_id}/integrity")
    def integrity(project_id: UUID) -> Any:
        return state.repository.verify_audit(project_id)

    @app.post("/api/v1/projects/{project_id}/repairs", response_model=RepairResult)
    def decide_repair(project_id: UUID, decision: RepairDecision) -> RepairResult:
        project = state.repository.get(project_id)
        graph = project.workflow.model_copy(deep=True)
        runtime = state.runtime(project_id)
        key = (decision.warning_code, decision.node_id)
        with runtime.lock:
            pending = runtime.pending_warnings.get(key, [])
            requested_patch = decision.repair_patch
            matched_index = next(
                (
                    index
                    for index, warning in enumerate(pending)
                    if (requested_patch is None or warning.repair_patch == requested_patch)
                ),
                None,
            )
            if matched_index is None:
                raise _problem(
                    "repair_not_pending",
                    "This repair does not match an unresolved server-generated warning",
                    status_code=409,
                )
            finding = pending[matched_index]
            if decision.decision == "approve" and (
                not finding.automatic_repair_available or finding.repair_patch is None
            ):
                raise _problem(
                    "repair_not_automatic",
                    "This finding requires an explicit workflow edit rather than automatic repair",
                    status_code=422,
                )
        if decision.decision == "reject":
            with runtime.lock:
                current = runtime.pending_warnings.get(key, [])
                if finding in current:
                    current.remove(finding)
                if not current:
                    runtime.pending_warnings.pop(key, None)
            state.repository.append_audit(
                project_id,
                "repair_rejected",
                f"Rejected repair for warning '{decision.warning_code}'.",
                decision.model_dump(mode="json"),
            )
            return RepairResult(applied=False, workflow=graph, stale_node_ids=[])
        patch = finding.repair_patch or {}
        action = patch.get("action")
        column = patch.get("column")
        node = next(
            (candidate for candidate in graph.nodes if candidate.id == decision.node_id), None
        )
        if node is None:
            raise _problem(
                "repair_node_not_found", "The repair target node does not exist", status_code=404
            )
        if action == "remove_feature" and node.type == "assign_roles" and isinstance(column, str):
            features = node.config.get("features")
            if not isinstance(features, list):
                raise _problem(
                    "repair_requires_explicit_features",
                    "Choose explicit feature roles before approving this repair",
                    status_code=422,
                )
            node.config["features"] = [feature for feature in features if feature != column]
        elif action == "ignore_column" and node.type == "assign_roles" and isinstance(column, str):
            ignored = list(node.config.get("ignored", []))
            if column not in ignored:
                ignored.append(column)
            node.config["ignored"] = ignored
            if isinstance(node.config.get("features"), list):
                node.config["features"] = [
                    feature for feature in node.config["features"] if feature != column
                ]
        else:
            raise _problem(
                "unsupported_repair",
                "This repair cannot be applied automatically; modify the workflow explicitly",
                status_code=422,
            )
        validation = GraphValidator(state.registry).validate(graph)
        if not validation.valid:
            raise _problem(
                "repair_invalid",
                "The proposed repair would make the workflow invalid",
                details=validation.model_dump(mode="json"),
                status_code=422,
            )
        stale = sorted(stale_after_change(project.workflow, graph))
        state.repository.save_workflow(project_id, graph, project.revision)
        runtime.executor.artifacts.clear_latest(set(stale))
        with runtime.lock:
            current = runtime.pending_warnings.get(key, [])
            if finding in current:
                current.remove(finding)
            if not current:
                runtime.pending_warnings.pop(key, None)
        state.repository.append_audit(
            project_id,
            "repair_applied",
            f"Approved and applied repair for warning '{decision.warning_code}'.",
            decision.model_dump(mode="json") | {"stale_node_ids": stale},
        )
        return RepairResult(applied=True, workflow=graph, stale_node_ids=stale)

    @app.get("/api/v1/projects/{project_id}/export")
    def export_project(project_id: UUID) -> JSONResponse:
        project = state.repository.get(project_id)
        payload = {
            "format": "libreml-project",
            "schema_version": "1.0",
            "project": project.model_dump(mode="json"),
            "audit": [
                event.model_dump(mode="json") for event in state.repository.audit_events(project_id)
            ],
            "artifacts_included": False,
            "security_notice": "Serialized Python model objects are intentionally excluded; rerun training after import. LibreML never loads untrusted pickle or joblib files.",
        }
        state.repository.append_audit(
            project_id,
            "project_exported",
            "Exported portable project metadata as JSON.",
            {"artifacts_included": False},
        )
        return JSONResponse(
            payload,
            headers={"Content-Disposition": f'attachment; filename="{project_id}.libreml.json"'},
        )

    return app


app = create_app()


def run() -> None:
    import uvicorn

    port = int(os.environ.get("LIBREML_PORT", "8000"))
    uvicorn.run("libreml_api.main:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    run()
