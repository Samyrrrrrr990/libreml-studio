# Security policy

## Supported versions

LibreML Studio is currently a pre-release Research Preview. Security fixes are applied to the default branch. No released version is yet guaranteed long-term support.

| Version | Supported |
| --- | --- |
| Default branch | Yes, best effort during preview |
| Older preview snapshots | No |

This table will be replaced with explicit supported release lines before v1.0.

## Reporting a vulnerability

Do **not** disclose a suspected vulnerability in a public issue, pull request, discussion, dataset, report, or project bundle.

Prefer GitHub Private Vulnerability Reporting once the repository has it enabled. If that channel is unavailable, contact the repository owner privately through the contact channel on their GitHub profile and request a secure reporting address. Do not send secrets, personal data, working exploits, or malicious files until a secure channel is confirmed.

Include, when safe:

- affected commit or version and operating system;
- component and attack prerequisites;
- reproducible steps using synthetic data;
- expected and observed impact;
- whether the issue can expose data outside the local machine;
- suggested mitigation, if known.

You should receive acknowledgment within 5 business days. Triage targets are not guarantees during the preview. Maintainers will coordinate validation, severity, remediation, disclosure timing, attribution preferences, and a CVE when appropriate. Please allow a reasonable remediation window before public disclosure.

## Security posture

LibreML Studio is local-first, not security-free. Its trust boundaries include:

- the local web UI and loopback API;
- imported CSV, spreadsheet, Parquet, archive, and project content;
- configured external APIs and their responses;
- generated HTML, SVG, spreadsheet, and model artifacts;
- plugins and optional packages;
- model serialization/deserialization;
- local project and credential storage.

The backend must bind to loopback by default, reject untrusted origins, validate every boundary model, constrain filesystem access to approved roots, neutralize spreadsheet formulas in exports, sanitize report content, limit resource use, and redact secrets. Arbitrary code/expression evaluation and automatic loading of untrusted pickle/joblib models are prohibited.

The detailed abuse cases and controls are in [docs/security/threat-model.md](docs/security/threat-model.md). Preview controls may be incomplete; do not use the software as an isolation boundary for malicious content.

## Safe-use guidance

- Use synthetic or de-identified data while evaluating the preview.
- Keep projects and exports in access-controlled local directories.
- Do not open project bundles, plugins, or serialized models from untrusted sources.
- Inspect spreadsheet exports before opening them in software that evaluates formulas.
- Do not expose the backend port to a LAN, public interface, tunnel, or reverse proxy.
- Review explicit network actions and credential scopes.
- Keep operating-system, browser/webview, Python, Node, and LibreML dependencies updated.
- Back up source data independently; the preview is not a backup system.

## Scope notes

Methodological errors without a security impact belong in the methodology issue template. Vulnerabilities in third-party packages should be reported upstream and privately to this project when LibreML is exploitable. The project does not offer a bug bounty at this time.
