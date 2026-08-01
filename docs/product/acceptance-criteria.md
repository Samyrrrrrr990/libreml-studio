# Acceptance criteria

These gates distinguish a working Research Preview from a UI demonstration. Evidence means automated tests, reviewed artifacts, or an explicitly linked manual assessment. Unchecked criteria block the corresponding release claim.

## Golden path

- [ ] A new user creates a local project and records a research question/mode.
- [ ] A synthetic CSV is imported with source metadata and fingerprint; no network request occurs.
- [ ] Bounded overview and detected roles are shown; user assigns target/features.
- [ ] The typed graph rejects a cycle and an incompatible edge with accessible errors.
- [ ] An integrity rule shows evidence and explanation; approve/reject is logged.
- [ ] Split precedes learned preprocessing; tests prove fit sees training rows only.
- [ ] Linear or logistic baseline trains locally with fixed seed where applicable.
- [ ] Held-out metrics include baseline, direction, limitation, and partition label.
- [ ] A versioned structured HTML report includes methods, environment, warnings/decisions, limitations, and citation; documented reproducibility tolerances are verified.
- [ ] Prediction uses the exact fitted preprocessing/model pipeline and validates schema.
- [ ] Save/reopen/rerun yields the documented equality/tolerance and preserves event history.

## Correctness and methodology

- [ ] Independent expected-value fixtures cover every claimed metric/procedure.
- [ ] Missing, constant, degenerate, tiny, imbalanced, multiclass, and invalid inputs fail or explain correctly.
- [ ] Test data never influences fitting or selection; final-test reuse is warned/blocked as designed.
- [ ] No feature-importance, association, or prediction output uses causal wording.
- [ ] Every node/metric/finding has reviewed Learning and Research explanation content.
- [ ] The release notes identify unvalidated, platform-sensitive, or unsupported cases.

## Persistence and reproducibility

- [ ] Project and workflow schemas are versioned, documented, and round-trip tested.
- [ ] Paths are portable/relative and traversal/symlink tests pass.
- [ ] Writes are atomic; interruption leaves a recoverable last-known-good state.
- [ ] Node, config, input digest, seed, and environment affect cache keys as documented.
- [ ] Changing an upstream result marks all and only descendants stale.
- [ ] No project load performs unsafe arbitrary object deserialization.

## Security and privacy

- [ ] API binds to loopback and fails tests for hostile Host/Origin and unintended public bind.
- [ ] Secrets are absent from logs, errors, projects, reports, exports, and test snapshots.
- [ ] Size/shape/resource limits fail safely before unreasonable materialization.
- [ ] Path, HTML/SVG, spreadsheet formula, filename, and malicious parser fixtures pass.
- [ ] No ordinary analysis/test performs an undeclared network request.
- [ ] Dependency/asset license inventory, vulnerability review, and secret scan are reviewed.
- [ ] Threat model and privacy documentation match behavior.

## User experience and accessibility

- [ ] Complete golden path is keyboard operable with visible focus and logical order.
- [ ] Status is conveyed by text/icon in addition to color.
- [ ] Screen-reader names and live progress/warning announcements are verified.
- [ ] Reduced-motion preference is honored.
- [ ] Destructive actions identify scope and require confirmation; undo/redo semantics are tested.
- [ ] Large tables use bounded data/virtualization and preserve accessible alternatives.

## Reliability and performance

- [ ] Supported platform/runtime matrix passes CI and a packaged smoke test where applicable.
- [ ] Cancellation, failure propagation, duplicate-run/idempotency, and crash recovery are tested.
- [ ] Performance envelopes state hardware, rows, columns, data types, operation, peak memory, and duration.
- [ ] Progress is factual or indeterminate; no fabricated percentage.

## Release and governance

- [ ] README status matrix and node/API documentation match executable capability discovery.
- [ ] Changelog, migrations, known limitations, license/notices, citation, and source offer are included.
- [ ] Licensing and contributor-IP policy have qualified legal review before commercial offering.
- [ ] Security disclosure channel and code-of-conduct contact are operational.
- [ ] Artifacts, checksums, provenance, and SBOM are produced through the reviewed release process.

## Full-product bar

A “full product” claim additionally requires stable public contracts, hardened desktop packaging/updater, complete supported node catalog, cross-platform migration/recovery, performance characterization, external security and accessibility assessments, qualified statistical review, production support policy, and no release-blocking open defect in supported paths. The roadmap does not waive these gates.
