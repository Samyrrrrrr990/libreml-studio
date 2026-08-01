"""Render the same analysis metadata as HTML, Markdown, and machine-readable JSON."""

from __future__ import annotations

import html
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from libreml_core.artifacts import MetricsArtifact, ReportArtifact, json_safe
from libreml_core.nodes import ExecutionContext, NodeExecutionOutput
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

LIBREML_VERSION = "0.1.0"
DEFAULT_PROJECT_URL = "https://github.com/Samyrrrrrr990/libreml-studio"
REPORT_CONTENT_SECURITY_POLICY = (
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; "
    "font-src 'none'; connect-src 'none'; object-src 'none'; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
)


class GenerateReportConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(default="LibreML Studio analysis", min_length=1, max_length=200)
    research_question: str = Field(default="Not specified", max_length=4000)
    dataset_description: str = Field(default="Local tabular dataset", max_length=4000)
    data_license: str = Field(default="Not specified by the researcher", max_length=500)
    limitations: list[str] = Field(default_factory=list, max_length=30)
    project_url: HttpUrl = HttpUrl(DEFAULT_PROJECT_URL)


def software_citation(project_url: str) -> dict[str, str]:
    return {
        "plain": f"LibreML Studio Contributors. (2026). LibreML Studio (Version {LIBREML_VERSION}) [Computer software]. {project_url}",
        "bibtex": "@software{libreml_studio_2026,\n  author = {{LibreML Studio Contributors}},\n  title = {LibreML Studio},\n  year = {2026},\n  version = {"
        + LIBREML_VERSION
        + "},\n  url = {"
        + project_url
        + "}\n}",
        "request": "If LibreML Studio materially supported this research, please cite the software in the resulting paper, thesis, report, dataset documentation, or other scholarly output. Citation helps readers reproduce the workflow and helps this free research tool grow.",
    }


def _format_value(value: Any) -> str:
    if value is None:
        return "Not available"
    if isinstance(value, float):
        return f"{value:.6g}"
    return str(value)


def _report_payload(
    config: GenerateReportConfig,
    metrics: MetricsArtifact,
    *,
    project_id: UUID,
    run_id: UUID,
    report_node_id: str,
    generated_at: datetime,
    workflow_warnings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    training = metrics.diagnostics.get("training", {})
    preprocessing = training.get("preprocessing", {}) if isinstance(training, dict) else {}
    environment = training.get("environment", {}) if isinstance(training, dict) else {}
    source = training.get("source", {}) if isinstance(training, dict) else {}
    warnings = list(workflow_warnings or []) + list(
        metrics.diagnostics.get("integrity_warnings", [])
    )
    deduplicated_warnings = list(
        {
            (
                warning.get("code"),
                json.dumps(warning.get("evidence", {}), sort_keys=True, default=str),
            ): warning
            for warning in warnings
        }.values()
    )
    payload = json_safe(
        {
            "schema_version": "1.0",
            "title": config.title,
            "research_question": config.research_question,
            "dataset": {
                "description": config.dataset_description,
                "source": source,
                "license": config.data_license,
            },
            "methodology": {
                "task": metrics.task,
                "algorithm": metrics.algorithm,
                "split": "A held-out test partition was evaluated once after model fitting.",
                "preprocessing": preprocessing,
                "leakage_control": "Imputation, encoding, and scaling were fitted on the training partition only and then applied unchanged to the test partition.",
            },
            "evaluation": {
                "metrics": metrics.metrics,
                "metric_explanations": metrics.explanations,
                "diagnostics": {
                    key: value
                    for key, value in metrics.diagnostics.items()
                    if key not in {"training", "integrity_warnings", "predicted_vs_observed"}
                },
            },
            "warnings_and_unresolved_issues": deduplicated_warnings,
            "limitations": config.limitations
            or [
                "Performance is estimated from one holdout partition and may vary in other populations.",
                "Predictive associations must not be interpreted as causal effects.",
                "Dataset fitness, construct validity, and measurement timing require domain review.",
            ],
            "provenance": {
                "project_id": str(project_id),
                "run_id": str(run_id),
                "report_node_id": report_node_id,
                "generated_at": generated_at.isoformat(),
            },
            "reproducibility": {
                "random_seed": training.get("random_seed") if isinstance(training, dict) else None,
                "environment": environment,
                "dataset_fingerprint": source.get("dataset_fingerprint")
                if isinstance(source, dict)
                else None,
                "file_sha256": source.get("file_sha256") if isinstance(source, dict) else None,
                "software": {
                    "name": "LibreML Studio",
                    "version": LIBREML_VERSION,
                    "url": str(config.project_url),
                },
                "citation": software_citation(str(config.project_url)),
            },
            "interpretation_notice": "These results describe predictive patterns in the analyzed data. They do not, by themselves, support causal claims.",
        }
    )
    if not isinstance(payload, dict):
        raise TypeError("Report payload must be a mapping")
    return payload


def _markdown(payload: dict[str, Any]) -> str:
    metrics = payload["evaluation"]["metrics"]
    methodology = payload["methodology"]
    reproducibility = payload["reproducibility"]
    provenance = payload["provenance"]
    lines = [
        f"# {payload['title']}",
        "",
        "## Research question",
        "",
        str(payload["research_question"]),
        "",
        "## Dataset",
        "",
        str(payload["dataset"]["description"]),
        "",
        f"Data licence: {payload['dataset']['license']}.",
        "",
        "## Methods",
        "",
        f"Task: {methodology['task']}. Candidate selected: {methodology['algorithm']}.",
        "",
        methodology["leakage_control"],
        "",
        "## Holdout evaluation",
        "",
        "| Metric | Value | What it measures | Caution |",
        "|---|---:|---|---|",
    ]
    for name, value in metrics.items():
        explanation = payload["evaluation"]["metric_explanations"].get(name, {})
        lines.append(
            f"| {name.replace('_', ' ').title()} | {_format_value(value)} | {explanation.get('measures', '')} | {explanation.get('caution', '')} |"
        )
    lines.extend(["", "## Limitations", ""])
    lines.extend(f"- {item}" for item in payload["limitations"])
    warnings = payload["warnings_and_unresolved_issues"]
    lines.extend(["", "## Warnings and unresolved issues", ""])
    lines.extend(
        f"- **{warning['title']}** — {warning['plain_explanation']}" for warning in warnings
    )
    if not warnings:
        lines.append(
            "No evaluation-stage warnings were recorded. Earlier workflow warnings should still be reviewed in the project audit log."
        )
    citation = reproducibility["citation"]
    lines.extend(
        [
            "",
            "## Software and reproducibility",
            "",
            f"Generated at: `{provenance['generated_at']}`. Project ID: `{provenance['project_id']}`. Run ID: `{provenance['run_id']}`.",
            "",
            f"Workflow fingerprint: `{_format_value(provenance.get('workflow_hash'))}`. Project revision: `{_format_value(provenance.get('project_revision'))}`. Workflow source: `{_format_value(provenance.get('workflow_source'))}`.",
            "",
            f"Random seed: `{reproducibility['random_seed']}`. Dataset fingerprint: `{reproducibility['dataset_fingerprint']}`.",
            "",
            str(citation["request"]),
            "",
            "Suggested citation:",
            "",
            f"> {citation['plain']}",
            "",
            "## Interpretation notice",
            "",
            str(payload["interpretation_notice"]),
            "",
        ]
    )
    return "\n".join(lines)


def _html(payload: dict[str, Any]) -> str:
    markdown_metrics = payload["evaluation"]["metrics"]
    explanations = payload["evaluation"]["metric_explanations"]
    metric_rows = "".join(
        "<tr><th scope='row'>"
        + html.escape(name.replace("_", " ").title())
        + "</th><td>"
        + html.escape(_format_value(value))
        + "</td><td>"
        + html.escape(explanations.get(name, {}).get("measures", ""))
        + "</td><td>"
        + html.escape(explanations.get(name, {}).get("caution", ""))
        + "</td></tr>"
        for name, value in markdown_metrics.items()
    )
    limitations = "".join(f"<li>{html.escape(str(item))}</li>" for item in payload["limitations"])
    warnings = payload["warnings_and_unresolved_issues"]
    warning_items = (
        "".join(
            f"<li><strong>{html.escape(str(item['title']))}:</strong> {html.escape(str(item['plain_explanation']))}</li>"
            for item in warnings
        )
        or "<li>No evaluation-stage warnings were recorded. Review the project audit log for earlier warnings.</li>"
    )
    citation = payload["reproducibility"]["citation"]
    provenance = payload["provenance"]
    title = html.escape(str(payload["title"]))
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="{html.escape(REPORT_CONTENT_SECURITY_POLICY, quote=True)}">
<title>{title}</title><style>:root{{--ink:#17201d;--muted:#5d6d66;--paper:#fbfcf8;--accent:#176b55;--line:#dce4dd}}*{{box-sizing:border-box}}body{{margin:0;background:#eef2ec;color:var(--ink);font:16px/1.62 system-ui,-apple-system,sans-serif}}main{{max-width:980px;margin:36px auto;background:var(--paper);padding:clamp(28px,6vw,72px);box-shadow:0 20px 60px #26362b1a}}h1{{font:700 clamp(2.2rem,6vw,4.5rem)/1.02 Georgia,serif;letter-spacing:-.04em;max-width:15ch}}h2{{margin-top:2.4em;font:600 1.45rem Georgia,serif;border-bottom:1px solid var(--line);padding-bottom:.4rem}}.kicker{{color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.12em;font-size:.75rem}}.notice,.citation{{border-left:4px solid var(--accent);padding:1rem 1.25rem;background:#edf5ef}}table{{border-collapse:collapse;width:100%;font-size:.9rem}}th,td{{text-align:left;vertical-align:top;padding:.65rem;border-bottom:1px solid var(--line)}}thead th{{color:var(--muted)}}code{{overflow-wrap:anywhere}}@media print{{body{{background:white}}main{{box-shadow:none;margin:0;max-width:none}}}}</style></head>
<body><main><p class="kicker">LibreML Studio research report</p><h1>{title}</h1>
<h2>Research question</h2><p>{html.escape(str(payload["research_question"]))}</p>
<h2>Dataset</h2><p>{html.escape(str(payload["dataset"]["description"]))}</p><p><strong>Data licence:</strong> {html.escape(str(payload["dataset"]["license"]))}</p>
<h2>Methods</h2><p><strong>Task:</strong> {html.escape(str(payload["methodology"]["task"]))}. <strong>Selected model:</strong> {html.escape(str(payload["methodology"]["algorithm"]))}.</p><p>{html.escape(str(payload["methodology"]["leakage_control"]))}</p>
<h2>Holdout evaluation</h2><div style="overflow-x:auto"><table><thead><tr><th>Metric</th><th>Value</th><th>What it measures</th><th>Caution</th></tr></thead><tbody>{metric_rows}</tbody></table></div>
<h2>Warnings and unresolved issues</h2><ul>{warning_items}</ul><h2>Limitations</h2><ul>{limitations}</ul>
<h2>Software and reproducibility</h2><p>Generated at: <code>{html.escape(str(provenance["generated_at"]))}</code><br>Project ID: <code>{html.escape(str(provenance["project_id"]))}</code><br>Run ID: <code>{html.escape(str(provenance["run_id"]))}</code><br>Workflow fingerprint: <code>{html.escape(_format_value(provenance.get("workflow_hash")))}</code><br>Project revision: <code>{html.escape(_format_value(provenance.get("project_revision")))}</code><br>Workflow source: <code>{html.escape(_format_value(provenance.get("workflow_source")))}</code></p><p>Random seed: <code>{html.escape(str(payload["reproducibility"]["random_seed"]))}</code><br>Dataset fingerprint: <code>{html.escape(str(payload["reproducibility"]["dataset_fingerprint"]))}</code></p><div class="citation"><p>{html.escape(str(citation["request"]))}</p><p><strong>Suggested citation</strong><br>{html.escape(str(citation["plain"]))}</p></div>
<h2>Interpretation notice</h2><p class="notice">{html.escape(str(payload["interpretation_notice"]))}</p></main></body></html>"""


def _write_report_files(
    project_dir: Path, generated_files: dict[str, str], contents: dict[str, str]
) -> None:
    project_root = project_dir.resolve()
    for name, relative_path in generated_files.items():
        if name not in contents:
            raise ValueError(f"Report format '{name}' has no rendered content")
        destination = (project_root / relative_path).resolve()
        if not destination.is_relative_to(project_root):
            raise ValueError("A generated report path escaped the project directory")
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(destination.suffix + ".tmp")
        temporary.write_text(contents[name], encoding="utf-8")
        temporary.replace(destination)


def finalize_report_provenance(
    artifact: ReportArtifact,
    *,
    project_dir: Path,
    project_id: UUID,
    project_title: str,
    project_mode: str,
    project_revision: int,
    run_id: UUID,
    workflow_hash: str,
    workflow_source: str,
) -> ReportArtifact:
    """Attach run-level provenance that is known only by the API coordinator."""
    copied = json.loads(json.dumps(artifact.json_report, ensure_ascii=False))
    if not isinstance(copied, dict):
        raise TypeError("Report payload must be a mapping")
    provenance = copied.get("provenance")
    if not isinstance(provenance, dict):
        provenance = {}
        copied["provenance"] = provenance
    provenance.update(
        {
            "project_id": str(project_id),
            "project_title": project_title,
            "project_mode": project_mode,
            "project_revision": project_revision,
            "run_id": str(run_id),
            "workflow_hash": workflow_hash,
            "workflow_source": workflow_source,
            "generated_at": provenance.get("generated_at") or datetime.now(UTC).isoformat(),
        }
    )
    markdown = _markdown(copied)
    rendered_html = _html(copied)
    contents = {
        "html": rendered_html,
        "markdown": markdown,
        "json": json.dumps(copied, ensure_ascii=False, indent=2, sort_keys=True),
    }
    _write_report_files(project_dir, artifact.generated_files, contents)
    return ReportArtifact(
        html=rendered_html,
        markdown=markdown,
        json_report=copied,
        generated_files=dict(artifact.generated_files),
    )


def execute_generate_report(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, GenerateReportConfig)
    metrics = inputs["metrics"]
    assert isinstance(metrics, MetricsArtifact)
    payload = _report_payload(
        config,
        metrics,
        project_id=context.project_id,
        run_id=context.run_id,
        report_node_id=context.node_id,
        generated_at=datetime.now(UTC),
        workflow_warnings=[
            warning.model_dump(mode="json") for warning in context.prior_warnings
        ],
    )
    markdown = _markdown(payload)
    rendered_html = _html(payload)
    reports_dir = context.project_dir / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    stem = (
        "research-report-"
        + "".join(
            character if character.isalnum() or character in "-_" else "-"
            for character in context.node_id
        )[:80]
    )
    paths = {
        "html": reports_dir / f"{stem}.html",
        "markdown": reports_dir / f"{stem}.md",
        "json": reports_dir / f"{stem}.json",
    }
    contents = {
        "html": rendered_html,
        "markdown": markdown,
        "json": json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
    }
    generated = {name: str(path.relative_to(context.project_dir)) for name, path in paths.items()}
    _write_report_files(context.project_dir, generated, contents)
    context.logger(
        "info",
        "Generated deterministic local report",
        {"formats": sorted(generated), "paths": generated},
    )
    return NodeExecutionOutput(
        values={
            "report": ReportArtifact(
                html=rendered_html,
                markdown=markdown,
                json_report=payload,
                generated_files=generated,
            )
        }
    )
