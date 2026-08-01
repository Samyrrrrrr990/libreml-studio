# LibreML project format

## Goals and status

The format is open, versioned, inspectable, portable, migratable, and safe to inspect without executing code. This document proposes format version `0.1`; the implementation and round-trip fixtures must land before it is considered stable.

Recommended extension for an unpacked project directory: `.libreml/` as a directory suffix. A future archive form may use `.libreml.zip`, but archive extraction requires its own hardened limits and is not implied by this specification.

## Directory layout

```text
example.libreml/
├── project.json
├── workflow.json
├── events.ndjson
├── environments/
│   └── <environment-id>.json
├── sources/
│   └── metadata.json
├── artifacts/
│   └── <artifact-id>/metadata.json
├── figures/
├── reports/
├── models/
└── notes/
```

Only `project.json` and `workflow.json` are required for an empty project. Project export may omit source data and artifacts. The manifest must state what is embedded, referenced, missing, or intentionally redacted.

## Minimal manifest

```json
{
  "format": "org.libreml.project",
  "schema_version": "0.1.0",
  "project_id": "018f...",
  "title": "Example study",
  "mode": "research",
  "research_question": "...",
  "workflow_path": "workflow.json",
  "event_log_path": "events.ndjson",
  "created_at": "2026-07-31T16:00:00Z",
  "updated_at": "2026-07-31T16:00:00Z",
  "application": {"version": "0.1.0", "commit": "..."},
  "contents": {"source_data": "referenced", "models": "omitted", "reports": "embedded"}
}
```

Unknown fields are preserved when possible. Unknown major schema versions are rejected without mutation. Loading never writes migration results over the only copy.

## Workflow document

`workflow.json` contains format/schema identifiers, workflow identity/revision, nodes, edges, and presentation metadata. Node configuration must be JSON-compatible and validated against the exact node type/version. Credentials are represented by opaque secret references, never values. Absolute source paths may be kept in local private state but are redacted or converted to portable references on export by default.

## Sources and fingerprints

Source metadata records display name, source kind, original filename (sanitized for display), optional URI with credentials/query secrets removed, access time, license/provenance supplied by the user or source, byte digest where available, parsing options, detected structure, and whether data is copied or referenced.

A fingerprint establishes identity, not anonymity. Hashes of small or guessable datasets may leak information and must not be published casually.

## Artifacts and models

Each artifact has a sidecar with kind, media type, schema, byte size, SHA-256, producing run/node/version, input digests, seed, environment reference, and payload-relative path. Paths use `/` separators in JSON and resolve inside the project root after normalization.

Models are stored only in formats the application explicitly recognizes. Pickle/joblib and equivalent executable object formats are never loaded from an untrusted or imported project automatically. If a trusted-local compatibility format is temporarily used, metadata must label it unsafe, loading requires explicit confirmation, and sharing guidance must warn recipients. A safer portable representation is a release goal, not a current guarantee.

## Event log

`events.ndjson` stores one versioned JSON event per line, in chronological append order. It records imports, graph edits, configuration, runs, findings, decisions, repairs, seeds, environment, reports, and exports. Redaction is mandatory. The format is append-oriented for auditability but is not cryptographically immutable or tamper-evident unless a future version specifies and verifies such a mechanism.

## Atomicity and recovery

Write payloads to a new temporary file in the same filesystem, flush as appropriate, validate/digest, then atomically replace the target. Maintain a recovery journal or last-known-good manifest before v1.0. Never follow symlinks out of the project root. Locking must prevent two writers from silently overwriting a project; revision conflicts are surfaced to the user.

## Migration contract

1. Detect version without executing project content.
2. Validate against the source-version schema.
3. Create a backup or migrated copy.
4. Apply pure, ordered migrations.
5. Validate the target version and all references/digests.
6. Record application version, migrations, warnings, and user confirmation.
7. Preserve unsupported data or stop; never silently discard it.

Every migration has before/after golden fixtures and idempotence/rollback analysis.

## Safe export

Export UI lists included data, models, logs, paths, connector metadata, and sensitive fields before writing. Secrets are excluded unconditionally by default. Spreadsheet cells beginning with formula-control characters are neutralized. HTML/SVG is sanitized. Archive names and extracted sizes/counts are bounded.
