# Statistical methodology policy

LibreML Studio is decision support, not an automatic authority. The application can compute selected procedures, check selected observable conditions, and explain limitations; it cannot validate a research design from data alone.

## General principles

1. State the research question and analysis population before choosing a procedure.
2. Separate exploratory from confirmatory analysis in project metadata and reports.
3. Define rows, units of observation, target, predictors, groups, and time ordering.
4. Split before learned preprocessing. Estimate transformation parameters using training data only.
5. Compare models against a meaningful simple baseline on data not used to fit them.
6. Report effect magnitude and uncertainty where applicable, not p-values alone.
7. Surface multiplicity, missing-data, dependence, sampling, and measurement limitations.
8. Avoid causal language unless design and assumptions support causal inference; the preview does not implement causal inference.

## Descriptive statistics

Each result identifies valid count, missing count/percentage, denominator, units, weighting, grouping, and missing-value policy. Variance/standard deviation specify sample versus population convention. Quantiles specify algorithm when reproducibility across libraries matters. Mode may be non-unique. Skewness/kurtosis identify estimator convention. Confidence intervals identify target quantity and method.

Do not summarize ordinal or categorical variables with inappropriate numeric statistics merely because their storage type is numeric.

## Supervised-learning evaluation

### Partitions

Training fits parameters. Validation/cross-validation supports selection and tuning. The final test set estimates performance after choices are fixed. Grouped or repeated observations require group-aware splits; time-dependent outcomes require order-aware methods. Random split is not a universal default.

Duplicate/near-duplicate entities crossing partitions can inflate apparent performance. Random seeds reproduce pseudo-random choices but do not eliminate sampling uncertainty.

### Regression

- MAE is in target units and robust relative to squared-error metrics, but weights all absolute errors linearly.
- MSE/RMSE emphasize large errors; RMSE is in target units.
- R² compares squared error to a mean baseline on the evaluated data and can be negative out of sample; it is not variance “explained” causally.
- Adjusted R² is appropriate only under clearly documented regression conditions and is not a general held-out metric.
- Residual plots diagnose patterns but do not prove assumptions.

### Classification

- Accuracy can mislead under imbalance.
- Balanced accuracy averages class recall and needs per-class context.
- Precision/recall/F1 depend on the positive class and decision threshold.
- ROC AUC is ranking performance across thresholds and can appear favorable in imbalanced settings; include precision-recall context.
- PR AUC must identify interpolation/average-precision convention and prevalence baseline.
- Log loss evaluates probabilities and penalizes confident errors.
- Calibration assesses agreement between predicted probabilities and observed frequencies; uncertainty and binning matter.

Multiclass metrics identify macro/micro/weighted averaging and include per-class results. Thresholds are selected without the final test set.

## Preprocessing

Imputation, encoding, scaling, transformation, feature selection, and learned outlier handling belong inside the fitted pipeline. Training-derived parameters are applied unchanged to validation, test, and prediction inputs. Missingness indicators and category grouping are methodological choices recorded in the report. Destructive row/column removal requires a visible rationale and sample impact.

## Inferential procedures: planned safe subset

The initial planned catalog includes Pearson/Spearman correlation, independent/paired t-tests, one-way ANOVA, Mann–Whitney U, Wilcoxon signed-rank, chi-square, and simple linear-regression inference. A procedure is not enabled until its node documents:

- exact research question/null/alternative and estimand/statistic;
- independent/paired/group structure and sampling assumptions;
- testable diagnostics and assumptions that cannot be verified;
- two-sided/one-sided choice and pre-specification warning;
- effect size and confidence interval where meaningful;
- missing/tie/zero/small-sample behavior and library convention;
- multiplicity context and correction options;
- interpretation wording and non-causal limitation;
- independent reference fixtures.

The software may recommend candidates and show reasoning, but it does not silently select a test.

## Interpretation

Coefficients depend on scale, encoding, regularization, link function, and collinearity. Permutation/model importance measures predictive reliance under a data/model configuration, not causation or intrinsic real-world importance. Partial dependence relies on feature-distribution assumptions and may evaluate implausible combinations. Individual explanations describe model behavior, not a person's true cause or entitlement.

Subgroup/error-slice analysis is exploratory unless pre-specified. Small slices and repeated searching create unstable findings. Performance parity metrics do not establish fairness, which requires social, legal, and domain context.

## Reproducibility evidence

Capture data fingerprints/source versions, workflow and node versions, configurations, seeds, library/runtime/platform versions, split membership or reproducible derivation, findings/decisions, artifacts, and report schema. Bitwise equality may be unavailable across platforms/native libraries; releases must state the achieved tolerance and determinism boundary.

## Method validation gate

A stable method requires primary/authoritative references, qualified review, analytical edge cases, hand-computable and independent-software fixtures, randomized/property tests where useful, cross-platform tolerance, explanation review, and documented unsupported cases. Matching the library wrapper to itself is not validation.
