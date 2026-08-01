from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID, uuid4

import pytest
from conftest import workflow_payload
from fastapi.testclient import TestClient
from libreml_api import main as api_main


def _create_project(client: TestClient) -> str:
    response = client.post(
        "/api/v1/projects",
        json={
            "title": "Security boundary study",
            "research_question": "Can the local boundary retain provenance?",
            "mode": "research",
        },
    )
    assert response.status_code == 201
    return str(response.json()["id"])


def test_graph_config_validation_redacts_values_and_run_audits_failure(
    client: TestClient,
) -> None:
    project_id = _create_project(client)
    secret = "super-secret-token-value"
    invalid_graph = {
        "schema_version": "1.0",
        "nodes": [
            {
                "id": "source",
                "type": "csv_import",
                "version": "1.0.0",
                "config": {
                    "path": "bundled:community_learning_outcomes.csv",
                    "api_token": secret,
                },
            }
        ],
        "edges": [],
    }

    validated = client.post(
        f"/api/v1/projects/{project_id}/workflow/validate", json=invalid_graph
    )
    assert validated.status_code == 200
    assert validated.json()["valid"] is False
    assert secret not in validated.text
    config_issue = next(
        issue
        for issue in validated.json()["issues"]
        if issue["code"] == "invalid_node_config"
    )
    assert config_issue["evidence"]["validation_errors"] == [
        {"location": ["api_token"], "type": "extra_forbidden"}
    ]

    saved = client.put(f"/api/v1/projects/{project_id}/workflow", json=invalid_graph)
    assert saved.status_code == 422
    assert secret not in saved.text

    run_id = str(uuid4())
    failed = client.post(
        f"/api/v1/projects/{project_id}/runs",
        json={"run_id": run_id, "workflow": invalid_graph},
    )
    assert failed.status_code == 422
    assert secret not in failed.text
    audit = client.get(f"/api/v1/projects/{project_id}/audit").json()["events"]
    run_events = [event for event in audit if event["payload"].get("run_id") == run_id]
    assert [event["event_type"] for event in run_events] == ["run_started", "run_failed"]
    assert secret not in json.dumps(run_events)


def test_upload_policy_failures_are_structured_and_cleaned_up(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = _create_project(client)

    wrong_extension = client.post(
        f"/api/v1/projects/{project_id}/imports",
        data={"source_type": "csv"},
        files={"file": ("study.exe", b"x,y\n1,2\n", "application/octet-stream")},
    )
    assert wrong_extension.status_code == 400
    assert wrong_extension.json()["error"]["code"] == "unsafe_import"

    empty = client.post(
        f"/api/v1/projects/{project_id}/imports",
        data={"source_type": "csv"},
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert empty.status_code == 400
    assert empty.json()["error"]["code"] == "empty_import"

    monkeypatch.setattr(api_main, "DEFAULT_MAX_IMPORT_BYTES", 4)
    too_large = client.post(
        f"/api/v1/projects/{project_id}/imports",
        data={"source_type": "csv"},
        files={"file": ("large.csv", b"12345", "text/csv")},
    )
    assert too_large.status_code == 413
    assert too_large.json()["error"]["code"] == "import_too_large"

    imports_dir = client.app.state.libreml.project_dir(UUID(project_id)) / "imports"
    assert list(imports_dir.iterdir()) == []


def test_generated_report_has_provenance_and_browser_isolation_headers(
    client: TestClient,
) -> None:
    project_id = _create_project(client)
    dataset = client.get("/api/v1/examples/community_learning_outcomes/download").content
    uploaded = client.post(
        f"/api/v1/projects/{project_id}/imports",
        data={"source_type": "csv"},
        files={"file": ("community.csv", dataset, "text/csv")},
    )
    assert uploaded.status_code == 201
    workflow = workflow_payload(uploaded.json()["relative_path"])
    saved = client.put(f"/api/v1/projects/{project_id}/workflow", json=workflow)
    assert saved.status_code == 200
    project_revision = saved.json()["project"]["revision"]

    run_id = str(uuid4())
    run = client.post(
        f"/api/v1/projects/{project_id}/runs",
        json={"run_id": run_id, "random_seed": 17},
    )
    assert run.status_code == 200, run.text
    assert run.json()["status"] == "succeeded"

    report = client.get(f"/api/v1/projects/{project_id}/reports/report")
    assert report.status_code == 200
    assert report.headers["x-content-type-options"] == "nosniff"
    assert report.headers["x-frame-options"] == "DENY"
    assert "default-src 'none'" in report.headers["content-security-policy"]
    assert 'http-equiv="Content-Security-Policy"' in report.text

    machine_report = client.get(
        f"/api/v1/projects/{project_id}/reports/report", params={"format": "json"}
    ).json()
    provenance = machine_report["provenance"]
    assert provenance["project_id"] == project_id
    assert provenance["project_title"] == "Security boundary study"
    assert provenance["project_mode"] == "research"
    assert provenance["project_revision"] == project_revision
    assert provenance["run_id"] == run_id
    assert provenance["workflow_hash"] == run.json()["workflow_hash"]
    assert provenance["workflow_source"] == "saved"
    assert datetime.fromisoformat(provenance["generated_at"]).tzinfo is not None
    assert provenance["workflow_hash"] in report.text
