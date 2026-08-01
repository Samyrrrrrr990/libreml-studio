# Citing LibreML Studio

If LibreML Studio materially supports analysis that you publish, teach, archive, or share, please cite the exact release and preserve enough provenance for another researcher to understand what ran.

Citation helps readers reproduce the work, gives contributors credit, and helps the project demonstrate research impact. It is a **strong scholarly request, not a condition or additional restriction of the AGPL software license**.

## What to record

- LibreML Studio version and, for development builds, Git commit;
- project-schema and relevant node versions when included by the report;
- operating system, Python/JavaScript runtime, and analytical package versions;
- random seeds and split strategy;
- data source, access date, version, license, and dataset fingerprint as appropriate;
- unresolved integrity findings and user-approved/rejected repairs;
- exported workflow or reproducibility bundle location, subject to data-governance rules.

Do not share restricted data merely to satisfy reproducibility. Use a data availability statement, controlled-access procedure, synthetic fixture, or source reference appropriate to the study.

## Software citation

Use the repository's `CITATION.cff` through GitHub’s “Cite this repository” control when available. For an archival release, prefer its DOI and generated citation over a mutable repository URL.

Until the first archived release, this generic form is appropriate:

> Shafiee, S. (year). *LibreML Studio* (version or commit) [Computer software].

Replace the year and version with the release actually used and append the canonical repository/DOI once published.

## Methods statement

Generated reports should include a copyable methods statement derived from recorded metadata. A concise form is:

> The analysis workflow was developed with LibreML Studio (version; commit), executed locally, and exported with recorded seeds, environment versions, integrity findings, and methodological decisions. Preprocessing was fitted using training data only. The authors reviewed all software warnings, method choices, assumptions, and interpretations.

Only retain the preprocessing sentence if it is true for the reported workflow. The software must never insert unsupported claims.

## Generated-report expectation

Every research report should contain a “Software and reproducibility” section with:

1. the LibreML Studio citation;
2. version/commit and project/report schema versions;
3. generation timestamp and run identifier;
4. environment/package manifest;
5. seed and data fingerprint information;
6. workflow, warning, repair, and limitation summary;
7. a statement that software assistance does not transfer methodological responsibility.

Researchers should cite primary sources for statistical methods and underlying libraries when disciplinary norms require them. Citing LibreML Studio does not replace citing a dataset, method, estimator, or dependency.
