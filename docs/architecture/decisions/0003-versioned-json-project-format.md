# ADR-0003: Versioned JSON project manifests with external artifacts

- Status: accepted
- Date: 2026-07-31

## Context

Projects must be inspectable, portable, migratable, and safe to load. Datasets/models/figures do not fit comfortably in a single JSON file; arbitrary Python serialization is unsafe.

## Decision

Persist human-readable versioned JSON manifests/workflows and NDJSON events. Store large artifacts separately with relative paths, schemas, byte size, and SHA-256 provenance. Use pure migrations and never auto-deserialize untrusted pickle/joblib content.

## Consequences

Projects are auditable and tooling-friendly. Multi-file atomicity, locking, missing artifacts, and archive security need deliberate implementation. JSON numeric/size limitations require typed artifact formats rather than inline analytical payloads.
