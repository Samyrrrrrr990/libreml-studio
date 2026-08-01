# Roadmap

LibreML Studio is planned as a full research product, delivered through evidence-based gates rather than a feature-count race. Dates are intentionally omitted until release capacity is known. “Complete” means its acceptance evidence is checked into the repository or linked from a release record.

## Current: v0.1 Research Preview

Goal: prove one coherent local workflow while establishing contracts that can support the full product.

Checked items below have current automated evidence for the stated preview behavior. They do not imply stable contracts, comprehensive method validation, external review, or satisfaction of the separate full-product bar.

- [ ] Create, reopen, and recover a versioned local project. **Partial:** create/save/retrieve and portable export exist; restart, interruption, and migration fixtures remain open.
- [x] Switch Learning and Research views without changing workflow semantics.
- [x] Import a local CSV with relative source metadata, content hash, and dataset fingerprint through the golden path.
- [ ] Promote Excel/Parquet imports to the same evidence level. **Partial:** bounded nodes and dependency round trips exist; direct node and adversarial parser fixtures remain open.
- [x] Inspect a bounded dataset preview and assign explicit feature, target, ignored, and task roles.
- [x] Reject typed-port incompatibilities and cycles before executing a topologically ordered workflow.
- [x] Split before learned preprocessing and train a seeded linear or logistic baseline locally.
- [x] Evaluate held-out data with metric direction, caution, baseline, partition provenance, and independent regression/binary/multiclass expected-value fixtures.
- [ ] Complete approve-and-reject integrity evidence. **Partial:** leakage blocking, server-matched approval, forged-request rejection, audit, and stale propagation are tested; the complete rejection UX path is not.
- [ ] Establish report and prediction release evidence. **Partial:** structured local reports, provenance, browser-isolation headers, and exact-pipeline prediction pass backend golden tests; byte-reproducibility and browser accessibility fixtures remain open.
- [ ] Save, restart, reload, and rerun with fixed inputs/seeds against documented equality tolerances. **Partial:** saved reruns and cache invalidation are tested; restart and tolerance evidence are not.
- [ ] Pass every backend, frontend, contract, security, accessibility, cross-platform, and golden-path release gate. Automated backend/frontend checks pass locally; accessibility, packaged, cross-platform, and external assessments remain open.

Unchecked items are not release claims. See [acceptance criteria](docs/product/acceptance-criteria.md).

## v0.2 Foundation hardening

- Atomic artifact storage, deterministic cache keys, lineage-based invalidation, and crash recovery.
- Cooperative cancellation, bounded workers, progress events, and resource estimates.
- Project schema migrations with forward/backward fixtures.
- Local secret-store abstraction with OS keychain adapters.
- Hardened CSV/Excel/Parquet ingestion, export formula neutralization, and malicious-file tests.
- Keyboard-complete canvas operations, screen-reader audit, and reduced-motion behavior.
- Signed release provenance, dependency review, SBOM generation, and cross-platform CI.

## v0.3 Complete tabular vertical slice

- Train/validation/test, stratified, group-aware, and cross-validation strategies.
- Numeric/categorical pipelines fit only on training partitions.
- Carefully documented regression and classification model set.
- Baselines, model comparison, calibration where supported, residual diagnostics, and error slices.
- Data-quality, missingness, duplicates, distribution, outlier, and class-balance views.
- Publication-ready PNG/SVG figures and Markdown/JSON/CSV report artifacts.
- Batch prediction with schema validation and safe exports.

## v0.4 Research integrity and statistics

- Leakage, identifier, duplicate-cross-split, imbalance, distribution-shift, evaluation-on-training, tuning-on-test, seed, and reproducibility rules.
- Explicit repair plans with preview, approval, audit entry, and stale propagation.
- Descriptive statistics with defined missing-data semantics.
- Limited inferential catalog: correlations, paired/unpaired comparisons, one-way ANOVA, rank tests, chi-square, and simple regression inference.
- Assumption checks, effect sizes, confidence intervals, multiplicity guidance, and observational/causal language guardrails.
- Statistical-methodology review records and verified fixtures against independent implementations.

## v0.5 Extensibility and connectors

- Versioned node SDK, compatibility policy, conformance tests, and documentation generator.
- Trust levels and explicit capabilities for extensions; no claim of secure plugin sandboxing until audited.
- Public Google Sheet and configurable REST imports as explicit network actions.
- Kaggle via user-owned credentials and official tooling, with dataset license/source capture.
- Optional local-language-model explanation provider outside the versioned structured-report path.

## v1.0 Production release

- Signed Tauri (or documented alternative) installers for supported operating systems.
- Safe updater, lifecycle management, loopback protection, backup, restore, and migration recovery.
- Complete supported-node documentation and deprecation policy.
- Research report, methods appendix, model card, project export, and reproducibility bundle.
- Performance envelopes documented by dataset shape and hardware class.
- External security assessment, accessibility assessment, statistical-methodology review, and license review.
- No open release-blocking issue in the supported golden paths.

## Beyond v1.0

Candidate domains—clustering, time series, survival analysis, Bayesian modelling, NLP, images, and remote compute—require separate methodology and threat-model work. Collaboration and enterprise capabilities may live in cleanly separated packages or services; they must not make the community core dependent on proprietary infrastructure.

## Known limitations of the Research Preview

- Interfaces, stored schemas, node identifiers, and APIs may change before v1.0.
- The preview is not a validated scientific instrument and has not completed external methodology or security review.
- Supported datasets and resource limits are not yet characterized for all platforms.
- CSV is the only import exercised through the complete golden workflow; Excel and Parquet node-level adversarial validation is incomplete.
- Project restart/recovery, schema migrations, cancellation/crash recovery, and reproducibility tolerances do not yet have release-level evidence.
- The current report records generation provenance but is not claimed to be byte-for-byte reproducible.
- Accessibility semantics and reduced-motion support are implemented in parts of the workbench, but no complete keyboard or screen-reader assessment has been recorded.
- Plugin sandboxing, remote execution, collaboration, causal inference, and regulated-use controls are not implemented.
- A warning engine can identify selected patterns; it cannot determine whether a study design is valid or replace domain review.
- Statistical assumptions often cannot be proven from data alone.
- Reproducibility depends on preserving source data, environment, artifacts, and external inputs—not only the workflow graph.

## Prioritization rule

Correctness and inspectability outrank catalog size. A new node enters a milestone only when its contract, validation, explanation, methodology note, fixtures, and end-to-end behavior can be completed together.
