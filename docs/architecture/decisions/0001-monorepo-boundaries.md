# ADR-0001: Monorepo with explicit domain boundaries

- Status: accepted
- Date: 2026-07-31

## Context

The product needs a TypeScript interaction layer, Python analytical runtime, shared contracts, documentation, and future extension/enterprise boundaries. Separate repositories would add contract/release friction before the team can support it; an unstructured monolith would put methods in routes/UI.

## Decision

Use one repository with `apps/*`, TypeScript `packages/*`, Python domain packages, tests, examples, and docs. Dependencies point from UI/transport through application services toward domain contracts. Statistical/ML/validation/reporting logic is independently testable. Community core never depends on separately licensed enterprise code.

## Consequences

Atomic cross-language changes and shared CI are easier. Tooling is more complex and package ownership must be enforced. The initial scaffold may be shallow, but moving directories cannot change the dependency direction.

Alternatives considered: separate frontend/backend repositories (premature release coordination); a single backend/UI package (poor testability and extensibility).
