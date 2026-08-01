"""Deterministic topological executor with caching and cooperative cancellation."""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import platform
import re
import time
from datetime import UTC, datetime
from pathlib import Path
from threading import Event
from typing import Any
from uuid import UUID, uuid4

from .artifacts import ArtifactEnvelope, ArtifactStore, artifact_preview, fingerprint_value
from .graph import GraphValidator, descendants, upstream_closure, workflow_fingerprint
from .nodes import ExecutionCancelled, ExecutionContext, NodeRegistry
from .schemas import (
    ArtifactSummary,
    NodeRunResult,
    NodeStatus,
    RunResult,
    RunStatus,
    Severity,
    ValidationIssue,
    WorkflowGraph,
)


class WorkflowExecutionError(RuntimeError):
    def __init__(self, message: str, issues: list[ValidationIssue] | None = None) -> None:
        super().__init__(message)
        self.issues = issues or []


class WorkflowExecutor:
    def __init__(self, registry: NodeRegistry, artifact_store: ArtifactStore | None = None) -> None:
        self.registry = registry
        self.artifacts = artifact_store or ArtifactStore()

    def execute(
        self,
        graph: WorkflowGraph,
        *,
        project_id: UUID,
        project_dir: Path,
        allowed_import_roots: list[Path],
        target_node_ids: list[str] | None = None,
        random_seed: int = 42,
        cancellation: Event | None = None,
        run_id: UUID | None = None,
        audit: Any = None,
    ) -> RunResult:
        validation = GraphValidator(self.registry).validate(graph)
        if not validation.valid:
            raise WorkflowExecutionError("Workflow validation failed", validation.issues)
        requested = set(target_node_ids or validation.execution_order)
        unknown_targets = requested - {node.id for node in graph.nodes}
        if unknown_targets:
            raise WorkflowExecutionError(f"Unknown target nodes: {sorted(unknown_targets)}")
        selected = upstream_closure(graph, requested)
        # Supersede prior publications before attempting anything that may affect
        # them. Cached nodes are republished below; failed descendants stay absent.
        invalidated = selected | descendants(graph, selected)
        self.artifacts.clear_latest(invalidated)
        order = [node_id for node_id in validation.execution_order if node_id in selected]
        by_id = {node.id: node for node in graph.nodes}
        incoming = {(edge.target_node, edge.target_port): edge for edge in graph.edges}
        cancel_event = cancellation or Event()
        run_id = run_id or uuid4()
        graph_fingerprint = workflow_fingerprint(graph)
        started = datetime.now(UTC)
        node_results: list[NodeRunResult] = []
        all_warnings: list[ValidationIssue] = []

        def log(level: str, message: str, fields: dict[str, Any]) -> None:
            if audit is not None:
                audit("node_log", f"[{level}] {message}", fields | {"run_id": str(run_id)})

        try:
            for node_id in order:
                if cancel_event.is_set():
                    raise ExecutionCancelled("Execution was cancelled")
                node = by_id[node_id]
                definition = self.registry.require(node.type)
                inputs: dict[str, Any] = {}
                input_fingerprints: dict[str, str] = {}
                for port in definition.inputs:
                    edge = incoming.get((node_id, port.name))
                    if edge is None:
                        continue
                    envelope = self.artifacts.get_latest(edge.source_node, edge.source_port)
                    if not isinstance(envelope, ArtifactEnvelope):
                        raise WorkflowExecutionError(
                            f"Output '{edge.source_port}' from '{edge.source_node}' is unavailable"
                        )
                    inputs[port.name] = envelope.value
                    input_fingerprints[port.name] = envelope.fingerprint
                cache_key = self._cache_key(
                    node.type, node.version, node.config, input_fingerprints, random_seed
                )
                started_node = time.perf_counter()
                cached = self.artifacts.get_cache(cache_key) if definition.cacheable else None
                if cached is not None:
                    cached_outputs, cached_warnings = cached
                    refreshed_outputs = {
                        port_name: ArtifactEnvelope(
                            type=envelope.type,
                            value=envelope.value,
                            fingerprint=envelope.fingerprint,
                            run_id=run_id,
                            workflow_fingerprint=graph_fingerprint,
                        )
                        for port_name, envelope in cached_outputs.items()
                    }
                    self.artifacts.set_latest(node_id, refreshed_outputs)
                    all_warnings.extend(cached_warnings)
                    cached_status = NodeStatus.WARNING if cached_warnings else NodeStatus.CACHED
                    node_results.append(
                        NodeRunResult(
                            node_id=node_id,
                            status=cached_status,
                            duration_ms=(time.perf_counter() - started_node) * 1000,
                            cache_key=cache_key,
                            output_ports=list(refreshed_outputs),
                            warnings=cached_warnings,
                            cache_hit=True,
                        )
                    )
                    if audit is not None:
                        audit(
                            "node_cache_hit",
                            f"Reused cached output for {definition.display_name} ({node_id}).",
                            {
                                "run_id": str(run_id),
                                "node_id": node_id,
                                "cache_key": cache_key,
                                "warning_codes": [warning.code for warning in cached_warnings],
                            },
                        )
                    if any(warning.severity == Severity.BLOCKING for warning in cached_warnings):
                        return self._result(
                            run_id, RunStatus.BLOCKED, node_results, all_warnings, started
                        )
                    continue

                def progress(current_node: str, fraction: float, message: str) -> None:
                    log(
                        "info",
                        message,
                        {"node_id": current_node, "progress": max(0.0, min(1.0, fraction))},
                    )

                context = ExecutionContext(
                    project_id=project_id,
                    run_id=run_id,
                    node_id=node_id,
                    random_seed=random_seed,
                    project_dir=project_dir,
                    allowed_import_roots=allowed_import_roots,
                    cancellation=cancel_event,
                    progress=progress,
                    logger=log,
                    environment=self._environment(),
                    prior_warnings=list(all_warnings),
                )
                try:
                    config = definition.config_model.model_validate(node.config)
                    output = definition.execute(config, inputs, context)
                    for warning in output.warnings:
                        if not warning.node_ids:
                            warning.node_ids = [node_id]
                    envelopes: dict[str, ArtifactEnvelope] = {}
                    for port_name, value in output.values.items():
                        output_port = definition.output(port_name)
                        if output_port is None:
                            raise WorkflowExecutionError(
                                f"Node '{node_id}' returned unknown output '{port_name}'"
                            )
                        envelopes[port_name] = ArtifactEnvelope(
                            type=output_port.type,
                            value=value,
                            fingerprint=fingerprint_value(value),
                            run_id=run_id,
                            workflow_fingerprint=graph_fingerprint,
                        )
                    required_outputs = {port.name for port in definition.outputs if port.required}
                    if missing := required_outputs - set(envelopes):
                        raise WorkflowExecutionError(
                            f"Node '{node_id}' did not produce required outputs: {sorted(missing)}"
                        )
                    self.artifacts.set_latest(node_id, envelopes)
                    if definition.cacheable:
                        self.artifacts.put_cache(cache_key, envelopes, output.warnings)
                    all_warnings.extend(output.warnings)
                    status = NodeStatus.WARNING if output.warnings else NodeStatus.SUCCEEDED
                    node_results.append(
                        NodeRunResult(
                            node_id=node_id,
                            status=status,
                            duration_ms=(time.perf_counter() - started_node) * 1000,
                            cache_key=cache_key,
                            output_ports=list(envelopes),
                            warnings=output.warnings,
                        )
                    )
                    if audit is not None:
                        audit(
                            "node_run",
                            f"Ran {definition.display_name} ({node_id}).",
                            {
                                "run_id": str(run_id),
                                "node_id": node_id,
                                "cache_key": cache_key,
                                "warnings": [warning.code for warning in output.warnings],
                            },
                        )
                    if any(warning.severity == Severity.BLOCKING for warning in output.warnings):
                        if audit is not None:
                            audit(
                                "run_blocked",
                                f"Run stopped after {definition.display_name} reported a blocking integrity issue.",
                                {"run_id": str(run_id), "node_id": node_id},
                            )
                        return self._result(
                            run_id, RunStatus.BLOCKED, node_results, all_warnings, started
                        )
                except ExecutionCancelled:
                    raise
                except Exception as exc:
                    safe_message = self._safe_exception_message(exc, context.allowed_import_roots)
                    node_results.append(
                        NodeRunResult(
                            node_id=node_id,
                            status=NodeStatus.FAILED,
                            duration_ms=(time.perf_counter() - started_node) * 1000,
                            cache_key=cache_key,
                            error=safe_message,
                        )
                    )
                    if audit is not None:
                        audit(
                            "node_error",
                            f"{definition.display_name} failed.",
                            {
                                "run_id": str(run_id),
                                "node_id": node_id,
                                "error_type": type(exc).__name__,
                                "message": safe_message,
                            },
                        )
                    return self._result(
                        run_id, RunStatus.FAILED, node_results, all_warnings, started
                    )
        except ExecutionCancelled:
            return self._result(run_id, RunStatus.CANCELLED, node_results, all_warnings, started)
        return self._result(run_id, RunStatus.SUCCEEDED, node_results, all_warnings, started)

    def _result(
        self,
        run_id: UUID,
        status: RunStatus,
        node_results: list[NodeRunResult],
        warnings: list[ValidationIssue],
        started: datetime,
    ) -> RunResult:
        summaries: list[ArtifactSummary] = []
        included_nodes = {
            result.node_id
            for result in node_results
            if result.status in {NodeStatus.SUCCEEDED, NodeStatus.WARNING, NodeStatus.CACHED}
        }
        for node_id, outputs in self.artifacts.all_latest().items():
            if node_id not in included_nodes:
                continue
            for port_name, envelope in outputs.items():
                summaries.append(
                    ArtifactSummary(
                        node_id=node_id,
                        port=port_name,
                        type=envelope.type,
                        fingerprint=envelope.fingerprint,
                        preview=artifact_preview(envelope.value),
                    )
                )
        return RunResult(
            run_id=run_id,
            status=status,
            node_results=node_results,
            artifacts=summaries,
            warnings=warnings,
            started_at=started,
            finished_at=datetime.now(UTC),
        )

    @staticmethod
    def _cache_key(
        node_type: str, version: str, config: dict[str, Any], inputs: dict[str, str], seed: int
    ) -> str:
        encoded = json.dumps(
            {
                "node_type": node_type,
                "version": version,
                "config": config,
                "inputs": inputs,
                "seed": seed,
            },
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
        return hashlib.sha256(encoded.encode()).hexdigest()

    @staticmethod
    def _environment() -> dict[str, str]:
        packages = {}
        for package in ("numpy", "pandas", "scikit-learn", "scipy"):
            try:
                packages[package] = importlib.metadata.version(package)
            except importlib.metadata.PackageNotFoundError:
                packages[package] = "unavailable"
        return {"python": platform.python_version(), "platform": platform.platform(), **packages}

    @staticmethod
    def _safe_exception_message(exc: Exception, local_roots: list[Path]) -> str:
        message = str(exc).replace("\n", " ")[:500]
        for root in local_roots:
            message = message.replace(str(root), "<local-data-root>")
        message = re.sub(
            r"(?i)(authorization|api[_-]?key|password|secret|token)(\s*[:=]\s*)[^\s,;]+",
            r"\1\2<redacted>",
            message,
        )
        return message or type(exc).__name__
