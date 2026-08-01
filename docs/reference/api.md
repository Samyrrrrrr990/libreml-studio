# Local API v0.1 reference

## Status and scope

This page documents the FastAPI routes implemented in the LibreML Studio Research Preview. The runtime OpenAPI document at `/api/openapi.json` is the machine-readable source of truth; the interactive development documentation is available at `/api/docs`.

The API is transport for a single-user local application. It is not a public, authenticated, multi-tenant, or remotely hardened service. All application routes are currently namespaced under `/api/v1`.

## Transport and current trust boundary

- The `libreml-backend` entry point binds to `127.0.0.1` by default and accepts an override for the port through `LIBREML_PORT`.
- Trusted hosts are limited to `localhost`, `127.0.0.1`, `[::1]`, and the test host.
- State-changing requests with an `Origin` header are rejected unless the origin is one of the configured local web or desktop origins. Requests without an `Origin` header remain possible for native/local clients.
- CORS permits the configured local Vite and desktop origins; it does not use a wildcard.
- There is no per-launch session token or request-ID middleware in v0.1. Loopback plus host/origin checks reduce exposure but do not authenticate another process running as the same user.
- Core project, import, execution, report, and prediction behavior does not require network access.

## Implemented `/api/v1` routes

| Method and path | Implemented behavior |
| --- | --- |
| `GET /api/v1/health` | Returns process status, API version, declared loopback bind host, storage kind, local-only flag, and telemetry status. It does not expose filesystem paths. |
| `GET /api/v1/node-types` | Returns the installed node catalog, including versioned ports, configuration schema/defaults, explanations, determinism/cache metadata, and resource hints. |
| `GET /api/v1/examples` | Lists bundled CSV examples and their suggested import-node configuration. |
| `GET /api/v1/examples/{dataset_id}/download` | Downloads a named bundled CSV after identifier and resolved-path checks. |
| `POST /api/v1/projects` | Creates a local project from `title`, optional `research_question`, and `mode`; returns `201`. |
| `GET /api/v1/projects` | Lists local project records. |
| `GET /api/v1/projects/{project_id}` | Returns one project record, including its saved workflow and revision. |
| `PUT /api/v1/projects/{project_id}/workflow` | Validates and saves a complete workflow. Optional `expected_revision` query input enables optimistic concurrency; a mismatch returns `409`. Invalid workflows are rejected with `422` and are not saved. The response includes validation and stale-node information. |
| `POST /api/v1/projects/{project_id}/workflow/validate` | Validates node configuration, typed ports, required connections, duplicate connections, and DAG topology without saving or executing the workflow. |
| `POST /api/v1/projects/{project_id}/imports` | Accepts multipart `file` plus `source_type` (`csv`, `excel`, or `parquet`), copies a bounded local upload into the project, records its digest, and returns a portable relative path plus suggested node configuration; returns `201`. It does not initiate a network import. |
| `POST /api/v1/projects/{project_id}/runs` | Executes synchronously against the saved workflow or an explicitly supplied ad hoc workflow. The request may include `run_id`, `target_node_ids`, and `random_seed`. The result contains terminal run/node status, warnings, safe artifact previews, timestamps, workflow hash, project revision, and workflow source. |
| `GET /api/v1/projects/{project_id}/runs/{run_id}` | Returns a run retained in the current backend process. Run results are not durable across backend restarts in v0.1. |
| `POST /api/v1/projects/{project_id}/runs/{run_id}/cancel` | Requests cooperative cancellation for a currently registered run and records the request in the audit log. Long-running library calls may only observe cancellation between bounded execution stages. |
| `GET /api/v1/projects/{project_id}/results/{node_id}` | Returns the latest typed outputs for a node in the saved workflow when their workflow fingerprint is current. Stale or unavailable results are rejected. |
| `POST /api/v1/projects/{project_id}/predictions/{trained_node_id}` | Applies the exact in-memory fitted preprocessing and model pipeline to up to 10,000 input rows after feature and numeric-type checks. Model objects are session-local and are not loaded from untrusted serialized files. |
| `GET /api/v1/projects/{project_id}/reports/{report_node_id}` | Returns a current generated report. Query `format` accepts `html` (default), `markdown`, or `json`. HTML responses include restrictive CSP, `nosniff`, frame-denial, no-referrer, and no-store headers. |
| `GET /api/v1/projects/{project_id}/audit` | Returns ordered project audit events and the current hash-chain integrity check. The chain detects modification; it is not a signature or proof of authorship. |
| `GET /api/v1/projects/{project_id}/integrity` | Returns only the audit hash-chain verification result. |
| `POST /api/v1/projects/{project_id}/repairs` | Approves or rejects an unresolved server-generated repair finding. Approval must match the pending warning and exact proposed patch; successful changes save a new workflow revision and mark affected descendants stale. |
| `GET /api/v1/projects/{project_id}/export` | Downloads an inspectable JSON project export containing project metadata and audit events. Data/model artifacts and executable Python serialization are intentionally excluded. |

## Core request shapes

### Create a project

```json
{
  "title": "Community learning outcome study",
  "research_question": "Which baseline factors predict completion?",
  "mode": "research"
}
```

`mode` is `learning` or `research`.

### Run a workflow

```json
{
  "run_id": "d2920f55-bb0e-4fa3-9615-1a6171f7f075",
  "target_node_ids": ["report"],
  "random_seed": 17
}
```

Omitting `target_node_ids` executes the complete saved graph. Supplying a `workflow` object executes that graph as an ad hoc request and records `workflow_source` accordingly. `random_seed` is bounded to the unsigned 32-bit range.

### Decide a repair

```json
{
  "warning_code": "direct_target_leakage",
  "node_id": "roles",
  "decision": "approve",
  "repair_patch": {
    "action": "remove_feature",
    "column": "outcome_proxy"
  }
}
```

A client cannot invent an automatic repair: the warning, node, and patch must match a finding retained by the backend from a prior run.

## Response and error conventions

Successful responses return either the typed resource directly or a small named envelope such as `{"nodes": [...]}`, `{"datasets": [...]}`, or `{"events": [...], "integrity": {...}}`.

The v0.1 error envelope is not yet uniform. Boundary, repository, workflow-execution, origin, and import-security handlers return:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request did not match the API schema.",
    "details": []
  }
}
```

Route-level resource/state failures raised through FastAPI's `HTTPException` currently use:

```json
{
  "detail": {
    "code": "result_stale",
    "message": "This result was not produced by the currently saved workflow",
    "details": null
  }
}
```

Clients must currently handle both shapes. Validation details omit rejected values, and run audit failures record error types rather than raw exception messages. Unifying the envelope is planned before declaring API stability.

## Status codes used by the implementation

- `200` for successful reads, validation, workflow saves, runs, cancellation decisions, predictions, reports, repairs, and exports;
- `201` for project creation and accepted local file imports;
- `400` for unsafe/empty imports, invalid example identifiers, and other malformed route-level requests;
- `403` for state-changing requests from an untrusted supplied origin;
- `404` for unknown projects or unavailable run/result/model/report resources;
- `409` for revision conflicts, duplicate run identifiers, stale artifacts, or repair-state conflicts;
- `413` for an upload over the configured byte limit;
- `422` for request-schema errors, invalid workflows, prediction schema/type errors, and unsupported repair application.

Generic internal failures do not yet have a documented stable response contract.

## Execution, concurrency, and durability

- Each project has a process-local artifact store and run registry. Project metadata, saved workflows, and audit events are durable in SQLite; fitted models, result artifacts, pending repair findings, and run lookup state are not.
- Workflow execution is serialized per project. A caller may send a cancellation request concurrently, but cancellation is cooperative.
- A client-supplied `run_id` is rejected while registered as running or already retained in the current process.
- Every recorded `run_started` event receives a terminal `run_finished` or `run_failed` event during normal exception handling.
- Report files use same-directory temporary writes followed by atomic replacement. This statement does not claim crash consistency for every project or artifact operation.

## Planned, not implemented in v0.1

The following surface remains design intent and must not be treated as callable:

- project metadata update and deletion routes;
- project-import and artifact-by-ID download/preview routes;
- pagination for project, audit, and artifact collections;
- durable run history, asynchronous job creation, progress polling, or Server-Sent Events;
- request IDs, a per-launch authentication/session token, and a single normalized error envelope;
- network connector routes and credential management;
- extension/plugin installation or execution routes;
- a standalone capabilities endpoint beyond the implemented node catalog and health response.

## Contract verification

The backend tests exercise the golden workflow, graph validation, host/origin rejection, upload bounds and cleanup, secret-value redaction, run terminal auditing, stale-result rejection, report security headers/provenance, repair matching, and project export behavior. Canonical OpenAPI snapshotting and generated TypeScript contract verification remain planned release hardening.
