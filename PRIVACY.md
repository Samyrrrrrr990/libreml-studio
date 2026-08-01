# Privacy

Last updated: 2026-07-31

This document describes the intended privacy behavior of the LibreML Studio community edition. It is product documentation, not a substitute for an organization's privacy notice or legal advice.

## Local-first default

Ordinary local workflows are designed to keep imported datasets, workflow configuration, models, artifacts, reports, notes, and application metadata on the user's computer. LibreML Studio does not require an account, mandatory analytics, a paid API, or a hosted language-model service for core analysis.

No telemetry is intended to be enabled by default. A future diagnostic or update-check feature must be separately documented, off by default unless clearly justified, and based on informed, reversible consent.

## Data stored locally

Depending on the workflow, the application may store:

- project metadata and research questions;
- data-source metadata, bounded previews, and dataset fingerprints;
- relative source references or user-approved project copies;
- workflow graphs, node configurations, seeds, and environment versions;
- artifacts, figures, trained pipelines, predictions, and reports;
- warnings, repairs, user decisions, logs, and execution history;
- connector configuration and credential references.

The exact Research Preview storage behavior must be verified against the release's project-format documentation. Deleting a project may not delete independently referenced source files, exported reports, backups, OS-level recent-file records, or copies created by other applications.

## Network activity

Network access is allowed only for visible, user-initiated functions such as a configured REST request, public-sheet import, Kaggle tooling, optional package installation, documentation, or update check. Before a connector sends data, the UI should identify the destination, method, and which configuration fields may be transmitted.

External services receive data under their own terms and privacy practices. Credentials must not be embedded in exported projects by default. A project may retain a non-secret credential reference; sharing the project does not grant another person the secret.

The development toolchain (for example npm, uv, GitHub, operating-system package managers, or vulnerability scanners) may use the network independently of the LibreML application.

## Logs and reports

Logs must avoid raw rows, access tokens, authorization headers, cookies, passwords, API keys, and local secrets. Error messages should use safe field names, counts, types, and correlation identifiers. Users should nevertheless inspect logs, projects, screenshots, reports, and support bundles before sharing; they may contain research questions, column names, distributions, file paths, predictions, or other sensitive metadata.

Generated reports reflect user-provided titles, labels, notes, and result summaries. Reports are local files until the user shares them. Citation metadata identifies LibreML Studio and its version, not study participants.

## Credentials

Production releases should use an operating-system-backed secret store. A development fallback that stores secrets less securely must be visibly labeled and must never be presented as production-safe. Secrets are excluded from exported projects, diagnostics, and audit events by default.

## Sensitive and regulated data

The Research Preview has not been assessed for HIPAA, GDPR, FERPA, PIPEDA, GLBA, clinical, biometric, export-control, or other regulated-data compliance. Local operation alone does not establish compliance. Organizations are responsible for lawful basis, consent, minimization, access control, retention, backups, disclosure review, and institutional approval.

Use synthetic or properly de-identified data until the application's security, retention, and institutional requirements have been evaluated.

## User controls and retention

The product direction is to provide project export, deletion, artifact cleanup, credential removal, and clear storage-location controls. Until those controls are verified in a release, users should manage the project directory and backups with operating-system tools. Secure deletion on SSDs and synchronized folders cannot be guaranteed by deleting through the application.

## Contributions and support

Never attach real participant data, private project bundles, credentials, or sensitive logs to a public issue. Follow [SECURITY.md](SECURITY.md) for vulnerability reports. Use minimal synthetic reproduction data for ordinary bugs.

Privacy-affecting changes require an update to this document, the threat model, relevant UI disclosures, and tests.
