# ADR-0005: Deterministic templates for core explanations

- Status: accepted
- Date: 2026-07-31

## Context

Reports and explanations must work offline, reproduce reliably, and avoid invented methodological claims. Mandatory hosted language models violate local-first and privacy constraints.

## Decision

Generate core explanations from versioned templates and typed analysis metadata. Keep factual computation, semantic selection, wording, and rendering separate. An optional future local/remote language-model adapter remains outside the reproducibility-critical path and requires explicit data-transmission consent when remote.

## Consequences

Wording is testable, consistent, and offline. Template coverage and qualified review require sustained editorial work. Generated prose may later improve flexibility but cannot replace deterministic methods/results or the audit log.
