# Changelog

All notable changes will be documented here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to adopt semantic versioning once public compatibility contracts stabilize.

## [Unreleased]

### Added

- Modern React/Vite workbench with a typed node canvas, searchable catalog, inspector, Learning/Research views, integrity/results/ledger/report/prediction panels, and an explicitly labelled bundled demonstration.
- Loopback-default FastAPI service with versioned project and workflow schemas, local SQLite metadata, typed graph validation, topological execution, caching, stale-lineage propagation, audit history, and portable project export.
- Bounded local CSV, Excel, and Parquet import nodes; dataset overview; explicit feature/target/task roles; train/test splitting; and train-only numeric/categorical preprocessing.
- Allowlisted regression and classification estimators with bounded parameters and worker use, held-out evaluation, transparent baselines, per-class diagnostics, and metric explanations.
- Evidence-backed leakage blocking with server-matched repair approval, rejection recording support, and downstream invalidation.
- Local HTML, Markdown, and JSON research reports with provenance, limitations, environment details, and software citation; exact fitted-pipeline interactive prediction.
- Bundled synthetic Community Learning Outcomes workflow and local dataset for the documented golden path.
- Repository governance, CI, security, privacy, citation, methodology, contributor, architecture, and development documentation.

### Changed

- Average Precision is named explicitly rather than being presented as generic precision-recall area, with holdout prevalence reported as its baseline.
- Binary ranking metrics now require an explicit positive class or emit a visible class-ordering warning; multiclass ROC AUC is labelled as support-weighted one-vs-rest.
- Reports and result payloads distinguish fitted backend artifacts from illustrative browser demonstration values.

### Fixed

- Prevented failed or partial reruns from serving unrelated or stale model, metric, prediction, or report artifacts.
- Preserved node warnings across cache hits and rejected forged, already-consumed, or invalid repair requests.
- Rejected unsafe paths, hostile Host/Origin requests, oversized transformations, and raw boundary values in validation errors.

### Security

- Added loopback-default serving, Host/Origin allowlists, import-root enforcement, upload cleanup, archive/file/shape limits, report Content Security Policy, output hardening, and redacted structured errors.
- Documented the initial local-application threat model, privacy boundary, dependency policy, and vulnerability disclosure process.

### Methodology

- Enforced explicit regression/classification task selection, class-preserving split checks, training-partition-only preprocessing, and held-out evaluation.
- Added training-mean, training-majority, class-frequency log-loss, chance-ranking, and positive-prevalence baselines where applicable.
- Made tiny-sample and constant-target R² behavior deterministic and visible instead of forwarding library warnings or finite substitutes.
- Added hand-checkable expected-value fixtures for regression, binary Average Precision/ROC AUC/log loss, and weighted one-vs-rest multiclass ROC AUC.

### Validation

- Added backend golden-path, graph/lineage, persistence/import, security, packaging, and methodology test suites.
- Added frontend contract, graph-safety, store-invalidation, mode-switching, and backend-failure tests, plus strict lint, type-check, and production-build commands.

### Known limitations

- This is an unstable Research Preview, not a validated scientific instrument or a finished full product; external security, accessibility, legal, and statistical-methodology reviews remain outstanding.
- CSV is the only fully exercised import in the end-to-end golden path. Excel and Parquet have bounded implementations and dependency round-trip evidence, but incomplete node-level adversarial fixtures.
- Project restart/recovery, schema migration, byte-level reproducibility, cancellation/crash recovery, cross-platform packaging, and performance envelopes are not release-validated.
- Inferential statistics, plugin execution, third-party connectors, collaboration, remote compute, causal inference, regulated-use controls, and signed desktop installers are not implemented.

## Release-note policy

Each release entry must separate added, changed, deprecated, removed, fixed, security, methodology, migration, and known-limitation items where applicable. Methodology-affecting behavior changes require a prominent note even when an API remains compatible.

Release links and dated entries will be added when a versioned GitHub release is cut; the repository URL alone does not establish a stable compatibility promise.
