# Contributing to LibreML Studio

Thank you for helping build a trustworthy research tool. Contributions are welcome across engineering, statistical methodology, accessibility, documentation, security, design, and reproducibility.

LibreML Studio is an early Research Preview. Prefer a small, fully tested vertical improvement over a broad partial implementation, and never describe planned behavior as shipped.

## Before you start

1. Read [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and the relevant methodology note.
2. Search existing issues and discussions.
3. Open a design issue before work that changes a persisted schema, public API, statistical result, security boundary, license, extension model, or large dependency.
4. Keep unrelated changes out of the same pull request.

Security vulnerabilities must follow [SECURITY.md](SECURITY.md), not the public issue tracker. Questions about whether an analysis is statistically appropriate belong in a methodology issue, with references and an explicit use case.

## Development setup

Follow [docs/development/setup.md](docs/development/setup.md). The expected top-level checks are:

```bash
uv sync --all-extras --locked
uv run pytest
npm ci
npm run test
npm run build
```

Use the commands actually declared in the repository; if a command is unavailable during the initial scaffold, document the gap rather than adding a passing no-op.

## Branches and commits

- Branch from the default branch and use a focused name such as `fix/split-leakage`.
- Write imperative commit subjects and explain why when the change is not obvious.
- Never commit datasets, credentials, local projects, trained models, generated reports with participant data, or environment files.
- Preserve user changes in a dirty worktree; do not rewrite unrelated history.
- Add a changelog entry for user-visible, security, migration, or methodology changes.

## Pull-request expectations

The pull request template is the minimum checklist. A reviewable change includes:

- problem and scope;
- screenshots or recordings for visible UI behavior, including keyboard/focus states;
- tests proportional to risk;
- documentation and status-matrix updates;
- migration and backward-compatibility analysis;
- privacy, security, performance, and accessibility impact;
- statistical assumptions, references, expected values, and limitations when applicable;
- disclosure of generated code or analysis assistance when material, with human verification.

Reviewers may ask for a smaller change or an ADR. Passing CI is necessary but not sufficient.

## Definition of done

A change is done only when:

- behavior is implemented end to end, not represented by a nonfunctional control;
- inputs and external data are validated at the boundary;
- errors are structured, safe, actionable, and do not leak secrets or rows;
- deterministic behavior has deterministic fixtures and seed handling;
- unit tests cover success, edge, and failure paths;
- relevant contract/integration tests cross the TypeScript/Python boundary;
- no ordinary test needs internet access;
- accessibility and reduced-motion behavior are checked for UI changes;
- docs, examples, status labels, and changelog are accurate;
- security and privacy effects are considered;
- methodology changes have independent expected values and qualified review;
- the full applicable test/lint/type/build suite passes.

## Adding a node

Follow [docs/development/node-authoring.md](docs/development/node-authoring.md). In summary, every node needs a stable namespaced type, semantic node version, typed ports, configuration schema and defaults, two-mode explanation, validation, deterministic/cache declaration, resource hints, structured errors/warnings, executor, migration strategy, fixtures, and documentation.

Do not add a model or statistical procedure merely to grow the catalog. A node without adequate explanation, validation, and tests is incomplete.

## Adding an integrity rule

Follow [docs/development/validation-rules.md](docs/development/validation-rules.md). Every finding needs a stable rule/version, severity, precise applicability, evidence, consequence, plain and technical explanations, limitations, recommendation, and—only when safe—an explicit repair plan. Repairs never execute silently.

## Adding explanation text

Follow [docs/development/explanations.md](docs/development/explanations.md). Explanations are versioned deterministic templates with typed inputs. Avoid causal, significance, certainty, or fairness claims that the evidence does not support. Define terms, contextualize metrics against baselines, and state what the software cannot establish.

## Methodology review

Changes to estimators, splits, preprocessing, metrics, statistical tests, confidence intervals, effect sizes, assumption checks, warnings, or interpretation require:

1. a documented estimand/research question and applicability boundary;
2. primary or authoritative references;
3. hand-computable and/or trusted independent reference cases;
4. tests for missingness, degeneracy, small samples, and invalid inputs;
5. stable output semantics including units and missing-value policy;
6. explanation and limitation text;
7. review by someone with relevant statistical expertise before a stable release.

Floating-point agreement with the same underlying dependency is not independent validation.

## Security and dependency review

New dependencies need a maintenance, license, size, supply-chain, and security justification. Avoid packages for trivial functions. File parsers, HTML renderers, model serialization, expression engines, plugins, native code, and network clients require heightened review. Pin workflow actions to immutable commit SHAs once the repository's release policy is operational.

## Contributor licensing and sign-off

Unless a file says otherwise, contributions accepted into the community edition are made available under `AGPL-3.0-or-later`.

The project intends to preserve an option for separately negotiated commercial licensing. A Developer Certificate of Origin sign-off confirms provenance but does **not necessarily grant relicensing rights**. Before accepting outside code that must be offered under both licenses, the project must adopt a lawyer-reviewed contributor agreement or limit commercial relicensing to code for which the copyright holder already has sufficient rights. The definitive policy is pending qualified legal review; maintainers must not imply that a checkbox or `Signed-off-by` line silently transfers copyright.

Until that policy is approved, maintainers should label external code contributions as community-license-only unless rights have been documented. Documentation, issue reports, and small non-copyrightable suggestions do not necessarily present the same relicensing issue, but legal conclusions must be made by counsel.

## Community conduct

All participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
