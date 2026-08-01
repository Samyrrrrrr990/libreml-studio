# AGENTS.md

These instructions apply to every automated coding agent working in this repository. More specific `AGENTS.md` files may add constraints for a subtree but may not weaken the local-first, security, licensing, statistical-integrity, or testing requirements here.

## Mission

Build LibreML Studio as a trustworthy local-first visual research environment. Hide incidental implementation complexity, not consequential methodological choices. Never silently change data or methodology, and never present placeholder behavior as complete.

The current milestone is a Research Preview vertical slice. The full product vision lives in [ROADMAP.md](ROADMAP.md); roadmap text is not authorization to claim or stub unsupported features.

## Repository map and boundaries

- `apps/web`: React/Vite workbench; presentation and interaction only.
- `apps/backend`: FastAPI transport and application composition.
- `apps/web/src/lib` and `apps/web/src/types`: frontend API adapters and wire contracts.
- `python/libreml_core`: graph, execution, artifact, persistence, and domain contracts.
- `python/libreml_nodes`: first-party nodes.
- `python/libreml_validation`: research-integrity rules and repair plans.
- `python/libreml_reporting`: report schemas/templates/renderers.
- `docs`: specifications, methodology, ADRs, and operations.
- `tests`: cross-package integration and golden-path coverage.

Preserve the dependency rule: UI/transport → application service → domain contract. Never put statistical/ML algorithms in React components or HTTP route handlers. Never make core packages depend on enterprise-only packages.

## Before editing

1. Inspect the tree, git status, relevant tests, and applicable docs.
2. Preserve unrelated user changes; do not run destructive Git commands.
3. State assumptions for minor ambiguity. Ask only if the answer changes scope, data safety, public behavior, licensing, or architecture materially.
4. Read the relevant ADR and specification. Propose an ADR for a durable decision not already covered.
5. Update the feature status truthfully: implemented, preview/partial, or planned.

## Expected commands

Use commands declared by the repository; do not create no-op scripts just to satisfy this list.

```bash
uv sync --all-extras --locked
uv run ruff check .
uv run mypy python apps/backend
uv run pytest

npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

Run the narrowest relevant tests while iterating and the complete applicable suite before handoff. Ordinary tests must not use the network or depend on time, locale, global random state, or developer-specific paths.

## Engineering style

- Strict TypeScript; Python 3.12+ type hints; Pydantic at external boundaries.
- Small, composable modules and explicit dependency injection.
- Structured error codes; do not silently catch or downgrade exceptions.
- No unexplained magic thresholds. Centralize and document methodological defaults.
- Use secure, portable relative paths and atomic writes.
- Use stable identifiers and explicit schema/node versions.
- Log metadata, not secrets or raw participant rows.
- Keep dependencies controlled; document maintenance, license, and security impact.
- Use plain-language UI copy, visible focus, semantic controls, and no color-only state.
- Honor reduced motion. Avoid animation that delays work or implies false progress.

## Non-negotiable constraints

- Core import, workflow, model, statistics, explanation, project, report, and prediction behavior works without internet, accounts, telemetry, paid APIs, or hosted language models.
- Network actions are explicit and visible. Bind the backend to loopback by default.
- No dataset, model, project, report, or metadata upload without informed user action.
- No `eval`, `exec`, shell interpolation, unrestricted expressions, or automatic deserialization of untrusted pickle/joblib files.
- No secret in logs, exports, project files, fixtures, screenshots, or errors.
- No learned preprocessing before split. Fit pipelines on training partitions only.
- No evaluation on training data masquerading as generalization performance.
- No automatic repair without explanation, evidence, preview, approval, audit event, and stale propagation.
- No causal language for association or feature importance without a supported causal design.
- Do not state that a null hypothesis is proven or equate statistical with practical significance.
- Do not invent statistical certainty, citations, security guarantees, or cryptographic immutability.

## Definition of done

A change is done when the supported path works end to end, boundary inputs are validated, failure behavior is explicit, appropriate unit/contract/integration tests pass, documentation and status are accurate, accessibility/security/privacy impacts are checked, and methodology behavior has independent expected-value evidence. Mocks and development fallbacks are labeled where they appear.

## Add a node

Follow [docs/development/node-authoring.md](docs/development/node-authoring.md):

1. define a stable namespaced type and semantic node version;
2. define typed ports and Pydantic configuration/defaults;
3. add Learning and Research explanations plus docs reference;
4. implement configuration, graph, and data-aware validation;
5. declare determinism, cache inputs, seed behavior, and resources;
6. implement through the structured execution context with cancellation/progress;
7. return typed artifacts and structured warnings/errors;
8. add migrations or explicitly state none are needed;
9. add unit, contract, failure, and integration fixtures;
10. update the catalog and status matrix only after tests pass.

## Add a validation rule

Follow [docs/development/validation-rules.md](docs/development/validation-rules.md). Rules are versioned, pure where possible, conservative about applicability, and evidence-backed. A finding contains severity, plain/technical explanations, evidence, likely consequence, recommendation, limitations, and optional explicit repair. Test true positives, true negatives, boundary values, missing evidence, deterministic ordering, and redaction.

## Add an explanation template

Follow [docs/development/explanations.md](docs/development/explanations.md). Use typed facts and versioned deterministic templates. Define unfamiliar terms, state directionality and baselines for metrics, distinguish observations from recommendations, and describe what cannot be inferred. Escape all user-controlled content. Snapshot tests complement—not replace—semantic assertions.

## Licensing and citation

New repository code is `AGPL-3.0-or-later` unless an approved notice says otherwise. Preserve third-party notices and run license review for new dependencies/assets. Do not write custom commercial terms. Do not assume an external contributor's AGPL submission can be commercially relicensed; follow [LICENSING.md](LICENSING.md).

Encourage scholarly citation and include report provenance, but never enforce citation as an extra software-license restriction.

## Handoff

Report exact files changed, commands/tests run with results, user-visible behavior, migrations, security/methodology implications, and remaining limitations. Do not say “production-ready,” “secure,” “validated,” “complete,” or “reproducible” without the corresponding acceptance evidence.
