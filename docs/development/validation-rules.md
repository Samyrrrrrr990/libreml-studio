# Integrity-rule authoring

The validation engine supports researchers; it does not certify study validity. Rules should detect narrowly defined evidence and explain uncertainty rather than issue broad verdicts.

## Rule phases

- **Schema:** malformed config, missing ports, unsupported node versions.
- **Graph:** cycles, type mismatch, split/preprocessing order, missing evaluation path.
- **Pre-run data:** shape, roles, missingness, identifiers, group/time hints, size.
- **Post-node:** fitted-state provenance, unseen categories, duplicates across splits.
- **Post-run:** suspicious performance, train/validation gap, metric suitability, unresolved assumptions.
- **Report:** missing provenance, unresolved blocking findings, unsupported causal wording.

## Finding contract

Every rule emits zero or more findings containing:

- stable `rule_id` and semantic `rule_version`;
- unique finding ID and precise scope;
- severity: `information`, `caution`, `warning`, or `blocking_error`;
- plain-language summary and technical explanation;
- structured evidence with counts/rates/thresholds and artifact provenance;
- likely consequence stated conditionally;
- recommended next action;
- what the rule cannot determine;
- optional repair proposal ID, never an executable callback.

Severity reflects risk and ability to proceed safely, not visual urgency. Blocking is reserved for invalid execution or results that cannot be interpreted as labeled.

## Explain-then-repair protocol

1. Detect and persist the finding.
2. Display explanation, evidence, uncertainty, and consequence.
3. Present a configuration/workflow diff and expected analytical change.
4. Accept approve, modify, reject, or documented override.
5. Record the decision separately.
6. On approval, apply an atomic revision through ordinary commands.
7. Record the repair and mark descendants stale.
8. Execute only after a new explicit run request or clearly confirmed action.

Even low-risk formatting auto-application is an explicit user preference and remains visible in the event log.

## Thresholds

Thresholds are versioned configuration with references or clearly marked heuristics. Evidence shows the actual value and threshold. Rules account for sample size and domain hints. A default such as “high missingness” is guidance, not a universal truth; users can override it and the report records that choice.

## Initial rule catalog

Priority rules include target leakage, learned preprocessing before split, duplicate rows crossing splits, identifier-like predictors, evaluation on training data, tuning against final test, group/time misuse, severe imbalance with unsuitable metrics, missing seeds, constant columns, excessive missingness, suspiciously high performance, and non-reproducible external input.

Later rules cover high cardinality, unseen categories, distribution shift, multicollinearity, influential observations, non-independence, multiple comparisons, and statistical-test assumptions. “Later” is not implementation status.

## Tests and review

Use table-driven fixtures for true positives, true negatives, boundary equality, missing evidence, user override, deterministic ordering, and safe redaction. Test repair diffs and stale descendants separately from detection. Measure noisy rules against a representative synthetic corpus before enabling them by default. Methodological rules require qualified review and references.
