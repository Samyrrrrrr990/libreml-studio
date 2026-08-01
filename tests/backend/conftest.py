from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from libreml_api.main import create_app


@pytest.fixture
def bundled_dataset() -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "apps"
        / "backend"
        / "libreml_api"
        / "resources"
        / "datasets"
        / "community_learning_outcomes.csv"
    )


@pytest.fixture
def client(tmp_path: Path, bundled_dataset: Path) -> TestClient:
    app = create_app(data_root=tmp_path / "state", bundled_data_root=bundled_dataset.parent)
    return TestClient(app)


def workflow_payload(import_path: str, *, include_leakage: bool = False) -> dict[str, Any]:
    features = ["age", "hours_studied", "attendance_rate", "prior_score", "program_type"]
    if include_leakage:
        features.append("outcome_proxy")
    nodes = [
        {"id": "source", "type": "csv_import", "version": "1.0.0", "config": {"path": import_path}},
        {
            "id": "overview",
            "type": "dataset_overview",
            "version": "1.0.0",
            "config": {},
            "position": {"x": 220, "y": 0},
        },
        {
            "id": "roles",
            "type": "assign_roles",
            "version": "1.0.0",
            "config": {
                "target": "completed_program",
                "features": features,
                "ignored": ["participant_id"] + ([] if include_leakage else ["outcome_proxy"]),
                "task": "classification",
            },
        },
        {
            "id": "split",
            "type": "train_test_split",
            "version": "1.0.0",
            "config": {"strategy": "stratified", "test_size": 0.2, "random_seed": 17},
        },
        {"id": "preprocess", "type": "tabular_preprocess", "version": "1.0.0", "config": {}},
        {
            "id": "model",
            "type": "model_definition",
            "version": "1.0.0",
            "config": {
                "task": "classification",
                "algorithm": "logistic_regression",
                "parameters": {"max_iter": 2000},
            },
        },
        {"id": "train", "type": "train_model", "version": "1.0.0", "config": {"random_seed": 17}},
        {"id": "evaluate", "type": "evaluate_model", "version": "1.0.0", "config": {}},
        {
            "id": "report",
            "type": "generate_report",
            "version": "1.0.0",
            "config": {
                "title": "Community learning outcome study",
                "research_question": "Which baseline factors predict completion?",
                "data_license": "CC0-1.0",
            },
        },
    ]
    edges = [
        {
            "id": "e1",
            "source_node": "source",
            "source_port": "dataset",
            "target_node": "overview",
            "target_port": "dataset",
        },
        {
            "id": "e2",
            "source_node": "overview",
            "source_port": "dataset",
            "target_node": "roles",
            "target_port": "dataset",
        },
        {
            "id": "e3",
            "source_node": "roles",
            "source_port": "labeled_dataset",
            "target_node": "split",
            "target_port": "labeled_dataset",
        },
        {
            "id": "e4",
            "source_node": "split",
            "source_port": "split_dataset",
            "target_node": "preprocess",
            "target_port": "split_dataset",
        },
        {
            "id": "e5",
            "source_node": "preprocess",
            "source_port": "prepared_dataset",
            "target_node": "train",
            "target_port": "prepared_dataset",
        },
        {
            "id": "e6",
            "source_node": "model",
            "source_port": "model_definition",
            "target_node": "train",
            "target_port": "model_definition",
        },
        {
            "id": "e7",
            "source_node": "train",
            "source_port": "trained_model",
            "target_node": "evaluate",
            "target_port": "trained_model",
        },
        {
            "id": "e8",
            "source_node": "evaluate",
            "source_port": "metrics",
            "target_node": "report",
            "target_port": "metrics",
        },
    ]
    return {"schema_version": "1.0", "nodes": nodes, "edges": edges}
