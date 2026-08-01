# Node-authoring guide

Nodes are methodological units, not arbitrary UI cards. A node is complete only when its contract, executor, validation, explanation, provenance, and tests agree.

## Stable identity

Use a reverse-domain or project namespace and a lowercase dotted type, for example `org.libreml.data.csv_import`. Node type and node version together resolve an exact specification. Display names may change; persisted identifiers may not. Increment versions when configuration, port, output, determinism, or methodology semantics change.

## Required specification

```text
type + version
display name + category + description
Learning explanation + Research explanation + documentation reference
input/output ports (name, cardinality, typed artifact contract)
Pydantic configuration schema + normalized defaults
static, graph, and data-aware validators
executor(execution_context, typed_inputs, config) -> typed_outputs
determinism + seed + cache policy
resource hints + supported limits
progress units + cancellation points
structured errors + findings/warnings
migrations + fixtures
```

The TypeScript UI consumes a serialized public specification; it is not a second source of truth for analytical defaults.

## Port types

Use the narrowest meaningful type: `Dataset`, `TrainDataset`, `ValidationDataset`, `TestDataset`, `FeatureMatrix`, `TargetVector`, `FittedTransformer`, `ModelDefinition`, `TrainedModel`, `Predictions`, `Metrics`, `FigureCollection`, `StatisticalResult`, or `ReportArtifact`. Subtyping must be explicit in the shared compatibility table. Do not accept `Any` to make canvas connections easier.

## Configuration

- Validate at the API boundary and again against the installed specification before execution.
- Defaults are named, documented methodological choices, not magic constants.
- Normalize unordered values before cache-key generation.
- Credentials are secret references, never config values.
- Derived features use an allowlisted expression AST; no Python, JavaScript, shell, imports, reflection, or dynamic property traversal.
- A config field documents units, allowed range, conditional visibility, and whether changing it invalidates outputs.

## Execution context

The executor receives project/run/node IDs, resolved seed, artifact store, structured logger, cooperative cancellation signal, progress callback, environment metadata, and bounded resource services. It does not read global application state or write arbitrary paths.

Check cancellation before expensive phases. Progress reports factual units. Write outputs through the artifact store; it validates, digests, and publishes atomically.

## Determinism and cache

Declare one of `deterministic`, `seeded`, or `non_deterministic` with rationale. A cache key includes node type/version, normalized config, upstream artifact digests, relevant runtime/library identity, and resolved seed. External mutable inputs are never cached as deterministic without a captured version/digest. Time, UI position, log wording, and project title do not affect analytical keys.

## ML pipeline rules

- Split before fitting imputers, encoders, scalers, feature selectors, or other learned transformations.
- Persist preprocessing and estimator as one exact inference pipeline.
- Validate task/target compatibility and partition provenance.
- Fit only on training inputs; validation guides selection; the test set is final evaluation.
- Include a simple baseline and contextual metrics.
- Feature importance is association with model behavior, not causal importance.

## Statistical-node rules

Document research question, estimand/statistic, assumptions, missing-data policy, alternatives, effect size, confidence interval, multiplicity context, degenerate cases, and language limitations. Do not automatically choose a test without exposing reasoning and user control.

## Tests

At minimum:

- specification/schema round trip and default normalization;
- compatible/incompatible port cases;
- happy path with fixed synthetic data and independent expected values;
- empty, missing, constant, extreme, malformed, and resource-bound inputs;
- deterministic repeat/cache-key behavior;
- cancellation and structured failure/redaction;
- no fit on validation/test data for learned transforms;
- migration fixtures for every prior persisted version;
- Learning/Research explanation facts;
- one graph-level integration test.

Register the node and update public status only after these pass.
