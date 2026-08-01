# Glossary

**Artifact** — A persisted node output such as a dataset partition, model, metric table, figure, or report, with type and provenance metadata.

**Association** — A statistical relationship between variables. Association alone does not demonstrate causation.

**Audit/decision log** — Chronological structured events describing workflow changes, runs, warnings, repairs, and user responses. “Append-oriented” does not mean cryptographically immutable.

**Baseline** — A simple comparison method, such as predicting the training mean or majority class, used to contextualize model performance.

**Cache key** — A digest of analytically relevant node/version/configuration/input/environment/seed facts used to decide whether an output may be reused.

**Calibration** — Agreement between predicted probabilities and observed event frequencies over comparable cases.

**Causal inference** — Estimation of intervention effects under a design and assumptions. Prediction or association alone is not causal inference.

**Confidence interval** — An interval produced by a repeated-sampling procedure with stated coverage under its assumptions; not generally the probability that a fixed parameter lies inside this realized interval.

**Cross-validation** — Repeated fitting/evaluation over training folds to estimate variability or guide selection without using the final test set.

**Data leakage** — Information unavailable at legitimate prediction time or reserved for evaluation influences fitting/features, making evaluation optimistic or invalid.

**Dataset fingerprint** — A digest and structural metadata used to identify source bytes/version. It is not anonymization.

**Effect size** — A measure of magnitude, distinct from statistical significance.

**Estimator** — An algorithm or rule that derives fitted parameters or an estimate from data.

**Finding** — An evidence-backed observation from an integrity rule, with severity, consequence, limitation, and recommendation.

**Fit** — Learn parameters from data. Imputation, scaling, encoding, feature selection, and models may all fit.

**Generalization** — Performance on relevant cases not used to fit or select the model.

**Learning Mode** — Presentation emphasizing definitions, examples, and guided reasoning. It does not change analytical semantics.

**Metric** — A defined numerical evaluation summary with direction, units/range, aggregation, baseline, and limitations.

**Node** — A versioned typed analytical operation with configuration, validation, execution, outputs, and explanation.

**Null hypothesis** — A specified hypothesis used by an inferential procedure. Failure to reject it does not prove it true.

**Pipeline** — Ordered preprocessing and model steps kept together for consistent fitting and inference.

**Practical importance** — Domain relevance of an effect or performance difference, distinct from statistical significance.

**Project schema** — Versioned definition of persisted LibreML project metadata and references.

**Provenance/lineage** — Evidence describing where an artifact came from, which inputs and operation produced it, and under what environment.

**Repair** — An explicit workflow/configuration change proposed for a finding and applied only after user authorization.

**Research Mode** — Presentation emphasizing methodological configuration, assumptions, lineage, and export. It shares workflow semantics with Learning Mode.

**Seed** — Input controlling a pseudo-random process. A seed improves repeatability but does not remove sampling uncertainty or guarantee cross-platform bitwise identity.

**Stale** — An output that cannot be treated as current because an upstream dependency changed.

**Test set** — Data reserved from fitting and selection for final evaluation of a fixed workflow.

**Training set** — Data used to fit model and preprocessing parameters.

**Validation set** — Data used during model/configuration selection, distinct from the final test set.

**Workflow** — A typed directed acyclic graph of node instances and edges.
