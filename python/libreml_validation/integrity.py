"""Central semantics for warnings that can or cannot permit downstream execution."""

from __future__ import annotations

from collections import Counter

from libreml_core.schemas import Severity, ValidationIssue


class IntegrityEngine:
    """Aggregate structured findings without silently changing methodology."""

    @staticmethod
    def has_blocking_issue(issues: list[ValidationIssue]) -> bool:
        return any(issue.severity == Severity.BLOCKING for issue in issues)

    @staticmethod
    def severity_counts(issues: list[ValidationIssue]) -> dict[str, int]:
        counts = Counter(issue.severity.value for issue in issues)
        return {severity.value: counts.get(severity.value, 0) for severity in Severity}

    @staticmethod
    def automatic_repairs(issues: list[ValidationIssue]) -> list[ValidationIssue]:
        return [
            issue for issue in issues if issue.automatic_repair_available and issue.repair_patch
        ]
