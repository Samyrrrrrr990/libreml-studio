# Release process

LibreML Studio releases are evidence bundles, not only tags. The project is a Research Preview; this process must be exercised on a release candidate before the first tagged release.

## Prepare

1. Choose the version and freeze the supported scope/status matrix.
2. Resolve every release-blocking item in [acceptance criteria](../product/acceptance-criteria.md), or document why the version cannot make that claim.
3. Update package versions, `CITATION.cff`, changelog, node/API/project schema documentation, migrations, and known limitations together.
4. Refresh lockfiles; review dependency, vulnerability, license, asset, and secret scans.
5. Run methodology review for changed analytical behavior and security/privacy review for changed boundaries.

## Verify

Run from a clean checkout with network disabled for the golden-path application test:

```bash
uv sync --all-extras --locked
uv run ruff check .
uv run mypy
uv run pytest --cov
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

Then exercise new-project, import, graph validation, warning/decision, execution, report, prediction, save/reopen, migration, cancellation/recovery, malicious-input, keyboard, and reduced-motion paths on every supported platform. Record hardware and tolerance for reproducibility/performance claims.

## Build and provenance

- Tag a reviewed commit with a signed `vMAJOR.MINOR.PATCH[-prerelease]` tag.
- Let the release-check workflow rebuild; do not upload a developer workstation's ad hoc artifacts as canonical.
- Generate checksums, SBOM, dependency/license notices, build provenance, and source archive.
- Include the unmodified AGPL text, Corresponding Source/source link, citation metadata, privacy/security documents, and commercial-license notice.
- Desktop artifacts additionally require code signing/notarization and reviewed updater metadata. The web preview archive is not a desktop installer.

## Publish

Create a GitHub **pre-release** while the project remains a Research Preview. Release notes list security, methodology, reproducibility, migration, deprecation, and known-limitation changes explicitly. Link archival DOI only after the exact artifacts are deposited. Never mark a release latest/stable until its declared gates pass.

## Rollback and response

Do not delete a released tag to hide a defect. Mark affected versions, publish a corrected release, and provide migration/rollback guidance. Security issues follow coordinated disclosure. Methodology defects that could change research conclusions receive the same prominence as serious functional defects, including affected versions/nodes and recomputation guidance.
