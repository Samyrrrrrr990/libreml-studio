# Architecture

## Purpose

LibreML Studio is a local-first research workbench with a browser-rendered node canvas and a Python analytical runtime. The architecture prioritizes methodological correctness, auditability, and replaceable interfaces over feature count. This document describes the intended production boundary and explicitly separates current Research Preview work from planned capability.

## System context

```text
Researcher
  │
  ▼
React/Vite workbench
  │ loopback HTTP + streamed progress
  ▼
FastAPI transport boundary
  │
  ├── project/application services ── SQLite metadata
  ├── workflow service ────────────── typed DAG + executor
  ├── integrity service ───────────── findings + proposed repairs
  ├── node registry ───────────────── local Python analytical code
  ├── artifact store ──────────────── datasets, figures, models, reports
  └── report service ──────────────── deterministic local templates
```

The browser never receives a whole large dataset by default. It receives bounded previews and artifact metadata. The backend binds to loopback by default and ordinary analysis makes no network call.

## Repository boundaries

The scaffold may evolve while preserving these responsibilities:

| Boundary | Responsibility | Must not contain |
| --- | --- | --- |
| `apps/web` | Workbench, canvas, inspectors, accessible interaction | Statistical algorithms, filesystem access, secrets |
| `apps/backend` | FastAPI composition, transport models, dependency wiring | Core ML/statistics implementations in route handlers |
| `packages/*` | TypeScript UI and shared wire contracts | Python execution logic |
| `python/libreml_core` | Graph contracts, executor, artifacts, persistence primitives | HTTP or component code |
| `python/libreml_nodes` | First-party node specifications and execution | Global mutable application state |
| `python/libreml_validation` | Integrity rules, evidence, repair proposals | Silent mutation |
| `python/libreml_statistics` | Reviewed statistical procedures | Product/UI wording |
| `python/libreml_reporting` | Structured report model and deterministic renderers | Unescaped user HTML |
| `tests` | Unit, contract, integration, and golden-path fixtures | Network-dependent ordinary tests |

If the implemented scaffold uses a shallower package tree during the Research Preview, dependencies must still point inward: transport → application services → domain contracts. See [ADR-0001](docs/architecture/decisions/0001-monorepo-boundaries.md).

## Core domain model

- **Project:** versioned metadata, workflow, research question, references to local artifacts, and a chronological decision ledger.
- **Workflow:** an acyclic graph of versioned node instances and typed edges.
- **Node specification:** stable type/version, ports, configuration schema, documentation, validation, execution, determinism, caching, resource hints, errors, warnings, and migrations.
- **Run:** immutable identity for one execution attempt, its environment, seed policy, state transitions, and node-run records.
- **Artifact:** content-addressed or uniquely identified local output with media type, schema, provenance, size, and integrity digest.
- **Finding:** evidence-backed integrity observation with severity, consequence, guidance, and optional repair proposal.
- **Decision event:** append-oriented record of a user approval, modification, rejection, or override. “Append-oriented” is not a claim of cryptographic immutability.
- **Report:** deterministic projection of project, run, artifact, finding, decision, and environment records.

Full field-level proposals are in [docs/architecture/data-model.md](docs/architecture/data-model.md).

## Typed workflow execution

1. Parse versioned workflow input through boundary schemas.
2. Resolve every node type and version from the registry.
3. Validate configuration, port compatibility, required inputs, and graph acyclicity.
4. Run static integrity rules and stop on blocking findings.
5. Calculate a topological execution plan.
6. For each selected node, calculate a cache key from implementation version, normalized configuration, upstream artifact digests, relevant environment, and seed.
7. Execute in a bounded worker context; emit structured progress and logs.
8. Persist artifacts atomically, then publish completion metadata.
9. Run data-aware integrity rules as required.
10. Mark descendants stale whenever upstream configuration or artifacts change.

Research Preview may implement only a subset of cancellation, durable caching, and resource isolation. Unsupported safeguards must fail explicitly; they must not be simulated in the UI.

## State and failure semantics

Node-run states are `queued`, `running`, `succeeded`, `warning`, `failed`, `cancelled`, and `stale`. A run state transition is one-way except that re-execution creates a new node-run attempt. Errors are structured with stable code, safe summary, optional user-action guidance, and a correlation identifier. Secrets and raw sensitive rows never belong in errors or logs.

Partial output is committed only if its node contract explicitly supports it. Downstream execution is skipped after an upstream failure. Cancellation is cooperative first; worker termination is a later isolation backstop.

## Persistence and portability

Project metadata uses an open, versioned JSON representation. Binary/columnar artifacts remain separate and are referenced by portable relative paths plus digests. Loading performs schema validation and migration before use. No untrusted pickle/joblib payload is deserialized automatically. See [project-format.md](docs/reference/project-format.md).

SQLite is appropriate for local application metadata and event indexes; analytical data should use bounded files and columnar processing rather than SQLite blobs. DuckDB/Polars/pandas choices are implementation details behind the dataset interface, selected by operation and compatibility.

## Explanations and reports

MVP/Research Preview explanation text comes from versioned, deterministic templates keyed by metric, finding, and node type. Template inputs are typed facts, not arbitrary HTML. Every explanation distinguishes observation, limitation, and guidance. Optional future language-model providers must be opt-in, local-capable, labeled as non-deterministic, and outside the reproducibility-critical path. See [docs/development/explanations.md](docs/development/explanations.md).

## Security boundaries

- The browser is untrusted input even when served locally.
- Imported files, archives, URLs, API responses, projects, plugins, models, and report content are untrusted.
- The API binds to `127.0.0.1`/`::1`, uses origin restrictions, and must not be exposed by default.
- All paths are resolved beneath explicit project/artifact roots.
- Expressions use a small parsed allowlist; `eval`, shell interpolation, and arbitrary imports are prohibited.
- Extensions execute with explicit capability declarations; strong sandboxing is a roadmap requirement, not a current guarantee.

See [SECURITY.md](SECURITY.md) and [docs/security/threat-model.md](docs/security/threat-model.md).

## Performance model

The target is an ordinary laptop, not frontier-scale training. Importers inspect size before materialization. The UI uses bounded previews and virtualized tables. Exploration can use an explicitly labeled sample. Execution estimates memory where feasible, applies configurable limits, persists intermediate artifacts, and invalidates cache through lineage—not timestamps alone.

## Packaging decision

The first development distribution is a loopback web application because it shortens feedback cycles and makes security behavior inspectable. Tauri is the preferred desktop candidate due to footprint and use of the system webview; Electron offers a more uniform runtime and mature ecosystem at higher memory/installer cost. Packaging is deferred until the vertical slice, updater threat model, process lifecycle, and cross-platform tests are stable. See [ADR-0002](docs/architecture/decisions/0002-loopback-first-packaging.md).

## Compatibility and versioning

Wire APIs use an explicit `/api/v1` namespace once stabilized. Project schema, node specifications, artifacts, and report schema carry independent versions. Additive compatible changes do not require project migration; incompatible persisted changes do. Node migrations are pure, version-to-version transformations with fixtures.

## Decision records

Architecture decisions live in [docs/architecture/decisions](docs/architecture/decisions). A decision that changes persistence, security posture, statistical interpretation, extension trust, or public contracts requires an ADR before merge.
