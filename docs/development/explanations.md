# Explanation system

Research Preview explanations are deterministic, local templates rendered from typed facts. They are not free-form generated scientific conclusions.

## Separation of concerns

- Domain code computes facts and result semantics.
- Explanation selectors choose a versioned template from explicit context.
- Renderers format escaped content for UI, plain text, Markdown, or reports.
- The UI controls progressive disclosure, not analytical wording.

Templates never query data, infer extra facts, or mutate a workflow.

## Required content

Node explanations define purpose, inputs/outputs, why the step may matter, assumptions, common mistakes, a small example, and next steps. Learning Mode starts with plain language and expandable depth. Research Mode starts with configuration, estimand/algorithm, provenance, assumptions, and citations. Both modes convey the same facts.

Metric explanations state what is measured, units/range, whether higher/lower is usually better, baseline/comparator, aggregation, conditions where the metric misleads, and relevant imbalance/threshold context.

Finding explanations state observation, evidence, conditional consequence, recommendation, alternative choices, repair effect, and what cannot be established.

## Language rules

- Use “associated with,” not “caused,” for observational/model importance results.
- Use “failed to reject” rather than “proved no effect.”
- Separate statistical significance, effect magnitude, uncertainty, and practical importance.
- Avoid “accurate” without a named metric, data partition, and baseline.
- Identify sampling and split context.
- Do not anthropomorphize a model as understanding or knowing.
- Define abbreviations on first use and include glossary links.

## Template contract

Each template has an ID/version, supported contexts, typed variables with unit/sensitivity metadata, required citations, escaping policy, and semantic test cases. Missing required facts produce an explicit unavailable sentence, never fabricated fallback values. User-authored labels are treated as text, not markup.

## Optional future language models

Any language-model provider is optional, user-initiated, labeled non-deterministic, and excluded from the core analysis/reproducibility path. Remote providers require a visible data-transmission preview and consent. Local providers declare hardware and model provenance. Generated prose cannot overwrite deterministic methods, results, findings, or audit events and must be reviewable before export.

## Review and tests

Tests assert key propositions and prohibited implications, not snapshots alone. Review plain/research variants together, missing/edge facts, escaping, localization readiness, terminology consistency, and accessibility. Methodology-affecting copy receives methodology review.
