"""Tests for the shared integrity-finding aggregation semantics."""

from libreml_core.schemas import Severity, ValidationIssue
from libreml_validation import IntegrityEngine


def _issue(
    code: str,
    severity: Severity,
    *,
    repair_patch: dict[str, str] | None = None,
) -> ValidationIssue:
    return ValidationIssue(
        code=code,
        severity=severity,
        title=f"Finding {code}",
        plain_explanation="A reviewable issue was found.",
        technical_explanation="Synthetic integrity-engine fixture.",
        likely_consequence="The workflow may require review.",
        recommended_repair="Review the evidence before continuing.",
        automatic_repair_available=repair_patch is not None,
        repair_patch=repair_patch,
    )


def test_integrity_engine_counts_and_gates_findings() -> None:
    issues = [
        _issue("note", Severity.INFORMATION),
        _issue("caution", Severity.CAUTION),
        _issue("review", Severity.WARNING),
        _issue("stop", Severity.BLOCKING),
    ]

    assert IntegrityEngine.has_blocking_issue(issues)
    assert IntegrityEngine.severity_counts(issues) == {
        "information": 1,
        "caution": 1,
        "warning": 1,
        "blocking_error": 1,
    }
    assert not IntegrityEngine.has_blocking_issue(issues[:-1])


def test_integrity_engine_returns_only_complete_automatic_repairs() -> None:
    repairable = _issue("repairable", Severity.WARNING, repair_patch={"action": "ignore"})
    manual = _issue("manual", Severity.WARNING)

    assert IntegrityEngine.automatic_repairs([manual, repairable]) == [repairable]
