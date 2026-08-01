from __future__ import annotations

from uuid import UUID, uuid4

from conftest import workflow_payload
from fastapi.testclient import TestClient


def create_and_upload(client: TestClient, dataset_bytes: bytes) -> tuple[str, str]:
    project_response = client.post(
        "/api/v1/projects",
        json={
            "title": "Reproducible completion study",
            "research_question": "Which baseline factors predict completion?",
            "mode": "research",
        },
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]
    upload = client.post(
        f"/api/v1/projects/{project_id}/imports",
        data={"source_type": "csv"},
        files={"file": ("community.csv", dataset_bytes, "text/csv")},
    )
    assert upload.status_code == 201, upload.text
    body = upload.json()
    assert not body["suggested_node_config"]["config"]["path"].startswith("/")
    return project_id, body["relative_path"]


def test_complete_local_classification_workflow(client: TestClient) -> None:
    assert client.get("/api/v1/health").json()["bind_host"] == "127.0.0.1"
    examples = client.get("/api/v1/examples").json()["datasets"]
    assert examples[0]["id"] == "community_learning_outcomes"
    dataset = client.get(examples[0]["download_url"]).content
    project_id, import_path = create_and_upload(client, dataset)
    workflow = workflow_payload(import_path)
    saved = client.put(f"/api/v1/projects/{project_id}/workflow", json=workflow)
    assert saved.status_code == 200, saved.text
    assert saved.json()["validation"]["valid"]

    run_id = str(uuid4())
    run = client.post(
        f"/api/v1/projects/{project_id}/runs", json={"run_id": run_id, "random_seed": 17}
    )
    assert run.status_code == 200, run.text
    result = run.json()
    assert result["status"] == "succeeded"
    assert result["workflow_hash"]
    assert result["project_revision"] == 2
    metrics_preview = next(
        artifact["preview"] for artifact in result["artifacts"] if artifact["port"] == "metrics"
    )
    assert metrics_preview["task"] == "classification"
    assert metrics_preview["algorithm"] == "logistic_regression"
    metrics = metrics_preview["metrics"]
    assert {"accuracy", "balanced_accuracy", "baseline_accuracy", "log_loss"} <= set(metrics)
    assert set(metrics) <= set(metrics_preview["explanations"])

    prediction = client.post(
        f"/api/v1/projects/{project_id}/predictions/train",
        json={
            "rows": [
                {
                    "age": 26,
                    "hours_studied": 14,
                    "attendance_rate": 91,
                    "prior_score": 78,
                    "program_type": "mentored",
                }
            ]
        },
    )
    assert prediction.status_code == 200, prediction.text
    assert len(prediction.json()["predictions"]) == 1
    assert prediction.json()["probabilities"]

    report = client.get(f"/api/v1/projects/{project_id}/reports/report", params={"format": "html"})
    assert report.status_code == 200
    assert "Software and reproducibility" in report.text
    assert "github.com/Samyrrrrrr990/libreml-studio" in report.text
    machine_report = client.get(
        f"/api/v1/projects/{project_id}/reports/report", params={"format": "json"}
    ).json()
    assert machine_report["reproducibility"]["citation"]["plain"]

    second = client.post(f"/api/v1/projects/{project_id}/runs", json={"random_seed": 17}).json()
    overview = next(node for node in second["node_results"] if node["node_id"] == "overview")
    assert overview["cache_hit"] is True
    assert any(warning["code"] == "identifier_column" for warning in second["warnings"])
    assert client.get(f"/api/v1/projects/{project_id}/audit").json()["integrity"]["valid"]
    exported = client.get(f"/api/v1/projects/{project_id}/export").text
    assert '"path":"imports/' in exported.replace(" ", "")
    assert "/projects/" not in exported


def test_leakage_blocks_until_matching_repair_is_approved(client: TestClient) -> None:
    dataset = client.get("/api/v1/examples/community_learning_outcomes/download").content
    project_id, import_path = create_and_upload(client, dataset)
    workflow = workflow_payload(import_path, include_leakage=True)
    assert client.put(f"/api/v1/projects/{project_id}/workflow", json=workflow).status_code == 200
    blocked = client.post(f"/api/v1/projects/{project_id}/runs", json={"random_seed": 17}).json()
    assert blocked["status"] == "blocked"
    assert "split" not in {node["node_id"] for node in blocked["node_results"]}
    leakage = next(
        warning for warning in blocked["warnings"] if warning["code"] == "direct_target_leakage"
    )
    assert leakage["node_ids"] == ["roles"]

    forged = client.post(
        f"/api/v1/projects/{project_id}/repairs",
        json={
            "warning_code": leakage["code"],
            "node_id": "roles",
            "decision": "approve",
            "repair_patch": {"action": "remove_feature", "column": "age"},
        },
    )
    assert forged.status_code == 409
    decision = {
        "warning_code": leakage["code"],
        "node_id": "roles",
        "decision": "approve",
        "repair_patch": leakage["repair_patch"],
    }
    repaired = client.post(f"/api/v1/projects/{project_id}/repairs", json=decision)
    assert repaired.status_code == 200, repaired.text
    assert repaired.json()["applied"]
    roles = next(node for node in repaired.json()["workflow"]["nodes"] if node["id"] == "roles")
    assert "outcome_proxy" not in roles["config"]["features"]
    assert client.post(f"/api/v1/projects/{project_id}/repairs", json=decision).status_code == 409
    rerun = client.post(f"/api/v1/projects/{project_id}/runs", json={"random_seed": 17}).json()
    assert rerun["status"] == "succeeded"


def test_api_rejects_untrusted_host_origin_and_redacts_invalid_input(client: TestClient) -> None:
    assert client.get("/api/v1/health", headers={"host": "evil.example"}).status_code == 400
    assert (
        client.post(
            "/api/v1/projects", headers={"origin": "https://evil.example"}, json={"title": "No"}
        ).status_code
        == 403
    )
    response = client.post("/api/v1/projects", json={"title": {"password": "super-secret"}})
    assert response.status_code == 422
    assert "super-secret" not in response.text


def test_failed_rerun_cannot_serve_previous_model_or_report(client: TestClient) -> None:
    dataset = client.get("/api/v1/examples/community_learning_outcomes/download").content
    project_id, import_path = create_and_upload(client, dataset)
    assert (
        client.put(
            f"/api/v1/projects/{project_id}/workflow",
            json=workflow_payload(import_path),
        ).status_code
        == 200
    )
    first = client.post(f"/api/v1/projects/{project_id}/runs", json={"random_seed": 17})
    assert first.status_code == 200
    assert first.json()["status"] == "succeeded"
    prediction_payload = {
        "rows": [
            {
                "age": 26,
                "hours_studied": 14,
                "attendance_rate": 91,
                "prior_score": 78,
                "program_type": "mentored",
            }
        ]
    }
    assert (
        client.post(
            f"/api/v1/projects/{project_id}/predictions/train",
            json=prediction_payload,
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/projects/{project_id}/reports/report").status_code == 200

    app_state = client.app.state.libreml
    imported_file = app_state.project_dir(UUID(project_id)) / import_path
    imported_file.write_text("age,hours_studied\n30,4\n31,7\n", encoding="utf-8")

    failed = client.post(f"/api/v1/projects/{project_id}/runs", json={"random_seed": 17})
    assert failed.status_code == 200
    assert failed.json()["status"] == "failed"
    roles_result = next(
        result for result in failed.json()["node_results"] if result["node_id"] == "roles"
    )
    assert roles_result["status"] == "failed"
    assert client.get(f"/api/v1/projects/{project_id}/results/train").status_code == 404
    assert (
        client.post(
            f"/api/v1/projects/{project_id}/predictions/train",
            json=prediction_payload,
        ).status_code
        == 404
    )
    assert client.get(f"/api/v1/projects/{project_id}/reports/report").status_code == 404
