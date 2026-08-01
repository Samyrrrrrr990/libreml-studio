# ADR-0004: UI-independent Python analytical executor

- Status: accepted
- Date: 2026-07-31

## Context

Python provides mature local libraries for tabular ML/statistics. Putting execution in a React or HTTP layer would couple methodology to presentation and make headless testing/extensions difficult.

## Decision

Implement typed DAG validation, topological execution, artifacts, cache semantics, progress, cancellation, and stale propagation in UI-independent Python domain packages. FastAPI adapts transport; React authors and observes workflows. Use scikit-learn/SciPy/statsmodels and dataframe engines behind reviewed node contracts rather than exposing arbitrary library calls.

## Consequences

The engine supports headless tests and future executors. Cross-language contracts and process lifecycle require explicit versioning. Python extensions are trusted code until isolation exists; arbitrary execution is not part of the preview.
