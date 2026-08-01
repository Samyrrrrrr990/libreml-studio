# Threat model

## Scope and assumptions

This model covers the single-user local web application, project/artifact storage, analytical runtime, local reports/prediction UI, explicit connectors, imports/exports, and future extensions. The Research Preview is not a sandbox for hostile content. The operating system, browser/webview, Python/Node runtimes, package supply chain, and user's account are trusted only to their documented boundaries.

Protected assets include research data, credentials, local files, model/project integrity, methodological provenance, availability of the workstation, and the researcher's ability to distinguish validated output from failure or tampering.

Potential adversaries include a malicious file/project/model/plugin author, hostile API or compromised upstream dataset, web page targeting a loopback service, local low-privilege process/user, compromised dependency/update channel, and an accidental user action.

## Trust boundaries

```text
untrusted browser content ┃ workbench ┃ loopback HTTP ┃ API/executor
untrusted files/APIs ━━━━━━━━━━━━━━━━┛       ┃
OS secret store ┃ project root ┃ artifact root ┃ generated exports
extension package ┃ extension capability boundary (planned, not a sandbox claim)
```

The UI is untrusted input. Loopback is not authentication: any browser page or local process may attempt requests. Imported content remains untrusted after parsing.

## Threats and required controls

| Threat | Example impact | Required controls / release evidence |
| --- | --- | --- |
| CSV/spreadsheet parser exploit | Code execution or file read | Maintained parsers, type/size bounds, malicious fixtures, process isolation roadmap |
| Spreadsheet formula injection | Export triggers formula/network action | Prefix/escape formula-leading cells, export tests, user warning |
| ZIP/decompression bomb | Disk/memory exhaustion | Preview archives disabled or bound entry count, expanded bytes, ratio, depth, and paths |
| Path traversal/symlink escape | Read/write outside project | Canonicalize beneath explicit root, reject absolute/`..`, do not follow escaping symlinks, tests |
| Unsafe filename/device name | Overwrite or platform failure | Generated internal IDs, display-name separation, cross-platform sanitization |
| Oversized/wide input | Memory/CPU denial | Preflight bytes/shape, streaming/bounded preview, time/memory/concurrency limits, cancellation |
| Malicious API response | Parser/XSS/resource abuse | Explicit request, scheme/redirect/content/size/time limits, typed extraction, escape output |
| SSRF via connector | Reach local/cloud metadata services | Restrict schemes, resolve/validate destinations and redirects, warn/block local/link-local by default |
| Credential leakage | Secret in config/log/report | OS keychain reference, redaction, no export, structured safe errors, secret scanning |
| Unsafe model deserialization | Arbitrary code execution | Never auto-load pickle/joblib; recognized safe formats; explicit trusted-local exception warning |
| Arbitrary expression execution | Code/file/network access | Small parsed AST allowlist, complexity bounds, no eval/import/attribute traversal |
| Malicious plugin | Full local compromise | Plugins disabled/clearly trusted in preview; signed provenance/capabilities/isolation before stronger claim |
| Report XSS/SVG injection | Script runs in local origin | Context-aware escaping, sanitizer, strict CSP, separate opaque origin/download behavior, fixtures |
| Loopback exposure | Other hosts access data/API | Preview: fixed loopback bind, Host/Origin validation, and no permissive CORS. Before v1: add a per-launch token and packaged-startup assertion. |
| Cross-site request to localhost | Malicious web page runs workflow | Preview: Origin checks and non-simple state-changing requests. Residual originless/same-user access remains until a per-launch token is implemented. |
| Dependency compromise | Build/runtime compromise | Lockfiles, minimal dependencies, Dependabot, review, hashes/provenance/SBOM for release |
| Update compromise | Malicious binary | Signed artifacts and manifests, verified updater, rollback; no auto-update claim before implemented |
| Log/preview disclosure | Sensitive row/path exposed | Metadata-only logs, bounded/redacted previews, support-bundle review |
| Project tampering | Misleading result/provenance | Schema/digest checks and safe failure; do not claim cryptographic immutability |
| Cache confusion | Result from wrong inputs/version | Content/config/version/seed/environment cache key, typed artifact verification |
| Concurrency/crash | Corrupt project | revision control, locking, same-filesystem atomic publish, recovery fixtures |
| Model abuse/invalid inference | Harmful decision or bad schema | exact pipeline, input bounds, warnings, no causal claim, domain responsibility |

## Connector policy

Network nodes are absent or disabled until invoked. The confirmation surface identifies host, method, redirects, pagination bounds, headers/query fields with secrets masked, and data leaving the machine. TLS verification stays enabled. Response bodies are never copied wholesale into errors. Credentials have least privilege and expiry guidance.

## Local server policy

The registered entry point binds to `127.0.0.1` with no public-bind option. Development conveniences do not enable `*` CORS. Generated HTML report responses receive a restrictive Content Security Policy; predictions are JSON rendered by the workbench. The health endpoint returns liveness, not environment paths or secrets. IPv6-specific behavior, per-launch authentication, and packaged-startup assertions remain pre-v1 hardening work.

## Extensions

Community-created nodes are a product goal, but a Python plugin normally has the user's privileges. Package signatures establish provenance, not safety. Until capability enforcement and process/OS isolation are audited, extensions must be described as trusted code and are disabled or require prominent confirmation. Projects do not auto-install missing plugins.

## Privacy and methodology abuse cases

Security review includes inference leakage from previews/logs, membership information in reports, accidental sharing of hashes/rare categories, and formulas/links in exports. Methodological integrity also requires preventing artifact substitution, training/test provenance confusion, forged success states, silent repairs, and stale-result presentation.

## Verification cadence

- Per PR: lint/type/test, dependency review, hostile-input unit tests for touched boundary.
- Per preview release: secret scan, dependency/license review, loopback/origin tests, project migration/recovery, malicious import/export corpus.
- Before v1.0: external application security review, updater/signing review, desktop cross-platform assessment, extension decision, incident-response exercise.

## Residual risk

Resource limits cannot make all parsers safe; local malware can access the same user data; statistical warnings cannot establish study validity; sanitized HTML libraries can have vulnerabilities; plugin isolation is not implemented; and digests without a trusted signature do not prove authorship. These limits must remain visible in release notes.
