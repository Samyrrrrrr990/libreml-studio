# LibreML Studio

**A local-first visual workbench for explainable, reproducible machine learning and statistical research.**

[![CI](https://github.com/Samyrrrrrr990/libreml-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Samyrrrrrr990/libreml-studio/actions/workflows/ci.yml)
[![License: AGPL v3+](https://img.shields.io/badge/license-AGPL--3.0--or--later-17283d)](LICENSE)
[![Cite this software](https://img.shields.io/badge/cite-CITATION.cff-a9671f)](CITATION.cff)

LibreML Studio is being built for researchers and domain experts who want a node-based workflow without giving up methodological control. Data, models, projects, and reports stay on the researcher's computer by default. Important choices are surfaced, warnings carry evidence, and repairs require approval.

> [!IMPORTANT]
> LibreML Studio is an early **Research Preview**, not a validated scientific instrument or a finished product. Independently verify analyses before using them in research, clinical, policy, financial, or other consequential decisions. See the [feature status](#feature-status) and [known limitations](ROADMAP.md#known-limitations-of-the-research-preview).

## Why LibreML Studio

- **Local by default:** ordinary workflows require no account, telemetry service, paid API, or hosted model.
- **Methodology is visible:** the workflow graph, seeds, transformations, warnings, and user decisions are inspectable.
- **Explain, then repair:** the integrity engine explains an issue, shows evidence, proposes a change, and records the user's response.
- **One workflow, two views:** Learning Mode emphasizes accessible teaching; Research Mode emphasizes assumptions, provenance, and reproducibility.
- **Typed workflows:** ports and graph validation reject nonsensical or unsafe connections before execution.
- **Structured local reporting:** Research Preview explanations and reports are generated locally from structured results and versioned templates, not a mandatory language-model API. Reports record generation and run provenance; byte-for-byte reproducibility has not yet been established.

## Feature status

This table describes executable capability without promoting roadmap designs into release claims. “Preview” means code and relevant automated evidence exist in the current development line, but contracts or validation remain unstable. “Partial” names the narrower behavior that is evidenced. “Planned” and “deferred” are not implemented release capabilities.

| Capability | Research Preview status | Full-product direction |
| --- | --- | --- |
| Local React workbench and visual DAG | Preview; typed canvas, inspector, panels, explicit demo state, and stale-result clearing are implemented | Desktop distribution, templates, grouping, and a fully audited keyboard workflow |
| Learning and Research views | Preview; a tested mode switch preserves workflow semantics | Reviewed, context-sensitive guidance throughout every supported node |
| Local FastAPI execution service | Preview; loopback-default service, validation, local runs, persistence, and explicit errors are implemented | Process-isolated workers, characterized cancellation/resource governance, and an optional remote executor interface |
| Versioned projects, audit, and export | Partial; create/save/retrieve, relative project paths, portable JSON export, and tamper-evident audit verification are implemented | Restart/recovery fixtures, migrations, backups, artifact bundles, and signed provenance |
| CSV import | Preview; the bundled end-to-end path verifies a relative local import, source hash, and dataset fingerprint | Streaming-scale ingestion, broader dialect handling, and platform performance envelopes |
| Excel and Parquet import | Partial; bounded local node implementations and dependency round-trip tests exist, but node-level adversarial fixtures are incomplete | Additional local formats, parser hardening, and a connector SDK |
| Typed DAG validation and execution | Preview; incompatible ports, cycles, topological execution, cache invalidation, partial runs, and stale lineage have automated evidence | Durable artifact cache, crash recovery, incremental reruns, and node migrations |
| Overview, roles, split, preprocessing | Preview; explicit task/roles, bounded overview, class-preserving split checks, train-only preprocessing, and memory guards are implemented | Group/time-aware splitting, richer diagnostics, transformations, and preparation recipes |
| Supervised models and evaluation | Partial; 13 allowlisted scikit-learn estimators are wired, while end-to-end release evidence centers on logistic regression plus independent regression, binary, and multiclass metric fixtures | Qualified review for each estimator, comparison, calibration, resampling, and broader independent fixtures |
| Integrity warnings and decision ledger | Preview; target-leakage blocking, server-matched repair approval, stale propagation, and hash-chain verification are tested | Broader evidence-backed rule coverage, complete approve/reject UX evidence, and reviewed repair migrations |
| Local reports and interactive prediction | Preview; HTML/Markdown/JSON report generation, browser-isolation headers, provenance, citation, and exact fitted-pipeline prediction have backend golden-path evidence | Publication figures, model cards, batch prediction, accessibility descriptions, and reproducibility-tolerance fixtures |
| Inferential statistics | Planned | Assumption-aware, effect-size-first test catalog |
| REST, Google Sheets, and Kaggle connectors | Planned | Explicit, user-initiated network actions with credential isolation |
| Plugin SDK | Contract under design | Signed/trusted extension profiles and expert sandboxing |
| Tauri desktop packaging | Decision deferred | Cross-platform signed installers after browser-local hardening |
| Collaboration or remote compute | Not implemented | Optional backends; local execution remains first-class |

The authoritative milestone boundary is in [ROADMAP.md](ROADMAP.md). A checked box or UI label is not proof of statistical validity; release acceptance is defined in [docs/product/acceptance-criteria.md](docs/product/acceptance-criteria.md).

## Architecture at a glance

```text
React workbench  ──HTTP/JSON──> localhost FastAPI boundary
      │                              │
workflow authoring              typed graph validation
explanations/UI                 topological executor
      │                              │
      └──────── versioned contracts ─┤
                                     ├─ node registry (data / ML / reporting)
                                     ├─ integrity rules and decision ledger
                                     ├─ artifact + project stores
                                     └─ versioned structured report renderer
```

The workflow engine is UI-independent. Statistical and ML logic belongs in domain packages, never route handlers or React components. Read [ARCHITECTURE.md](ARCHITECTURE.md), the [API contract](docs/reference/api.md), and the [project-format specification](docs/reference/project-format.md).

## Development quick start

Prerequisites: Python 3.12, [`uv`](https://docs.astral.sh/uv/), Node.js 20+, and npm 10+.

```bash
# Python environment and checks
uv sync --all-extras --locked
uv run pytest

# Web workbench
npm ci
npm run dev
```

The development UI and API are separate local processes; follow [docs/development/setup.md](docs/development/setup.md) for the exact commands, ports, environment variables, production build, and troubleshooting. The backend must bind to loopback only by default.

## Research use and citation

If LibreML Studio materially supports published or shared research, **please cite the exact software version** and include the generated methods citation or equivalent provenance statement. Citation helps reviewers reproduce the work and helps this community demonstrate impact. It is a strong scholarly request, **not an additional condition of the software license**. See [CITATION.md](CITATION.md) or use GitHub’s “Cite this repository” control.

Suggested methods language:

> Analysis workflows were developed with LibreML Studio (version and commit), executed locally, and exported with the project’s recorded seeds, package versions, warnings, and methodological decisions.

You remain responsible for reviewing whether the selected methods, assumptions, interpretations, and claims are appropriate.

## Privacy and security

LibreML Studio is local-first, but “local” does not automatically mean safe. Spreadsheet formulas, untrusted serialized models, plugins, API responses, report HTML, and oversized files all create risks. Do not open untrusted project bundles or model artifacts. Review [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), and the [threat model](docs/security/threat-model.md).

Please report vulnerabilities privately using the process in [SECURITY.md](SECURITY.md); do not open a public issue containing exploit details or sensitive data.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Methodology changes need fixtures, limitations, explanation copy, and a qualified review path—not only code. Node authors should follow [docs/development/node-authoring.md](docs/development/node-authoring.md).

## License

The community edition is offered under the [GNU Affero General Public License v3.0 or later](LICENSE), an OSI-approved open-source copyleft license. AGPL permits commercial use; its conditions include source-sharing obligations in covered distribution and modified network-service scenarios. Organizations that cannot comply with AGPL obligations may seek a separately negotiated commercial license from the copyright holder.

The citation request is not a license restriction. See [LICENSING.md](LICENSING.md) for the open-source/source-available/dual-license distinction and important contributor-IP caveats. This licensing strategy requires qualified legal review before a commercial launch.

---

LibreML Studio does not replace statistical judgment, peer review, domain expertise, or independent validation.
