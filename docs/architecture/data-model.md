# Data model

This is the logical model. Concrete Pydantic/TypeScript names may differ during the preview; changes to persisted meaning require an ADR and migration.

## Identifiers and versions

Identifiers are opaque UUIDs or equivalent collision-resistant values. User-facing names are never keys. Timestamps are RFC 3339 UTC. Digests identify bytes using an explicitly named algorithm (initially SHA-256). Versions are strings validated by the owning schema.

## Entities

### Project

| Field | Purpose |
| --- | --- |
| `project_id` | Stable project identity |
| `schema_version` | Project-manifest schema |
| `title`, `research_question`, `notes` | User-authored research context |
| `mode` | `learning` or `research`; presentation preference only |
| `workflow` | Current graph |
| `data_sources` | Provenance and fingerprint records, no embedded secret |
| `artifact_index` | Relative artifact references and metadata |
| `environment_snapshots` | Runtime/package/platform facts for runs |
| `event_log` | Append-oriented chronological events |
| `created_at`, `updated_at` | Lifecycle timestamps |

### Workflow

`workflow_id`, `schema_version`, `nodes[]`, and `edges[]`. A node instance contains `node_id`, stable `node_type`, `node_version`, display position, normalized configuration, and optional annotation. An edge contains its own identity plus source/target node and port identifiers. UI position and group membership never affect analytical cache keys.

### Node specification

Registry metadata includes unique namespaced type, semantic version, display metadata, typed ports, configuration schema/default, two-mode explanations, static/data validation hooks, executor reference, determinism and cache policies, resources, documented errors/warnings, documentation URI, migration functions, and fixture identifiers.

### Run and node run

A run records `run_id`, project/workflow revision, selection, status, requested/started/finished times, seed policy, environment snapshot, execution plan, and node-run attempts. Each attempt records state transitions, normalized cache key, input/output artifact IDs, progress, duration, structured logs, findings, and structured error. Retrying creates a new attempt.

### Artifact

| Field | Required meaning |
| --- | --- |
| `artifact_id` | Stable identity |
| `kind` / `media_type` | Machine-interpretable type |
| `schema_version` | Artifact metadata/payload contract |
| `relative_path` | Path resolved beneath project artifact root |
| `sha256`, `size_bytes` | Integrity and resource evidence |
| `created_by` | Run/node/attempt provenance |
| `inputs` | Upstream artifact identifiers/digests |
| `dataset_shape`, `columns` | Optional bounded structural metadata |
| `sensitivity` | User/project classification hint, not automatic compliance |

### Finding and repair proposal

A finding contains stable `rule_id` and `rule_version`, finding identity, severity (`information`, `caution`, `warning`, `blocking_error`), scope, evidence facts, plain and technical explanations, likely consequence, recommendation, limitations, and optional repair proposal.

A proposal describes operations, affected nodes/artifacts, configuration diff, expected effect, risks, and reversibility. It has no authority to execute. A separate decision records approve, modify, reject, or override with actor and time.

### Event

Events are structured envelopes: `event_id`, schema version, project ID, optional run/node, event type/version, timestamp, actor (`user`, `system`, `extension`), safe payload, and correlation/causation IDs. Events are append-oriented and machine-readable. The preview must not claim tamper evidence or cryptographic immutability unless implemented and verified.

## Core invariants

- Every edge resolves to two existing ports with compatible types.
- The executable graph is acyclic.
- Every persisted node type/version resolves or produces a clear migration/missing-extension error.
- Artifact paths are relative, normalized, and remain beneath their approved root.
- A digest mismatch prevents artifact use.
- Secret values never appear in source records, node config exports, events, logs, or reports.
- A successful node run publishes only complete, validated artifacts.
- Approved repairs produce explicit workflow revisions and invalidate descendants.
- Mode switching does not alter the workflow, data, or analytical configuration.

## Relationships

```text
Project 1──1 Workflow
Project 1──* DataSource
Project 1──* Run 1──* NodeRun
NodeRun *──* Artifact (input/output lineage)
Project 1──* Finding 1──0..1 RepairProposal
Project 1──* DecisionEvent
Project 1──* EnvironmentSnapshot
```
