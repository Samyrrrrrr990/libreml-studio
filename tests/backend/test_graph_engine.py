from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from libreml_core.execution import WorkflowExecutor
from libreml_core.graph import GraphValidator, stale_after_change
from libreml_core.schemas import WorkflowGraph
from libreml_nodes import build_registry


def test_typed_graph_rejects_incompatible_ports_and_cycles() -> None:
    registry = build_registry()
    incompatible = WorkflowGraph.model_validate(
        {
            "nodes": [
                {"id": "source", "type": "csv_import", "config": {"path": "imports/data.csv"}},
                {
                    "id": "roles",
                    "type": "assign_roles",
                    "config": {"target": "y", "features": ["x"], "task": "regression"},
                },
                {"id": "overview", "type": "dataset_overview", "config": {}},
            ],
            "edges": [
                {
                    "id": "bad",
                    "source_node": "overview",
                    "source_port": "overview",
                    "target_node": "roles",
                    "target_port": "dataset",
                },
                {
                    "id": "seed",
                    "source_node": "source",
                    "source_port": "dataset",
                    "target_node": "overview",
                    "target_port": "dataset",
                },
            ],
        }
    )
    result = GraphValidator(registry).validate(incompatible)
    assert not result.valid
    assert "incompatible_port_types" in {issue.code for issue in result.issues}

    cyclic = WorkflowGraph.model_validate(
        {
            "nodes": [
                {"id": "a", "type": "dataset_overview", "config": {}},
                {"id": "b", "type": "dataset_overview", "config": {}},
            ],
            "edges": [
                {
                    "id": "ab",
                    "source_node": "a",
                    "source_port": "dataset",
                    "target_node": "b",
                    "target_port": "dataset",
                },
                {
                    "id": "ba",
                    "source_node": "b",
                    "source_port": "dataset",
                    "target_node": "a",
                    "target_port": "dataset",
                },
            ],
        }
    )
    cycle_result = GraphValidator(registry).validate(cyclic)
    assert not cycle_result.valid
    assert "cycle_detected" in {issue.code for issue in cycle_result.issues}


def test_stale_detection_propagates_only_changed_lineage() -> None:
    before = WorkflowGraph.model_validate(
        {
            "nodes": [
                {"id": "source", "type": "csv_import", "config": {"path": "imports/a.csv"}},
                {"id": "overview", "type": "dataset_overview", "config": {}},
            ],
            "edges": [
                {
                    "id": "edge",
                    "source_node": "source",
                    "source_port": "dataset",
                    "target_node": "overview",
                    "target_port": "dataset",
                }
            ],
        }
    )
    after = before.model_copy(deep=True)
    after.nodes[0].config["delimiter"] = ";"
    assert stale_after_change(before, after) == {"source", "overview"}


def test_partial_run_does_not_return_unrelated_previous_artifacts(
    tmp_path: Path, bundled_dataset: Path
) -> None:
    registry = build_registry()
    executor = WorkflowExecutor(registry)
    graph = WorkflowGraph.model_validate(
        {
            "nodes": [
                {"id": "one", "type": "csv_import", "config": {"path": str(bundled_dataset)}},
                {"id": "two", "type": "csv_import", "config": {"path": str(bundled_dataset)}},
            ],
            "edges": [],
        }
    )
    common = {
        "project_id": uuid4(),
        "project_dir": tmp_path,
        "allowed_import_roots": [bundled_dataset.parent],
    }
    first = executor.execute(graph, target_node_ids=["one"], **common)
    assert {artifact.node_id for artifact in first.artifacts} == {"one"}
    second = executor.execute(graph, target_node_ids=["two"], **common)
    assert {artifact.node_id for artifact in second.artifacts} == {"two"}


def test_role_change_invalidates_downstream_cache(tmp_path: Path, bundled_dataset: Path) -> None:
    registry = build_registry()
    executor = WorkflowExecutor(registry)
    base = {
        "nodes": [
            {
                "id": "source",
                "type": "csv_import",
                "config": {"path": str(bundled_dataset)},
            },
            {
                "id": "roles",
                "type": "assign_roles",
                "config": {
                    "target": "completed_program",
                    "features": ["age", "hours_studied"],
                    "task": "classification",
                },
            },
            {
                "id": "split",
                "type": "train_test_split",
                "config": {"strategy": "stratified", "random_seed": 17},
            },
        ],
        "edges": [
            {
                "id": "source-roles",
                "source_node": "source",
                "source_port": "dataset",
                "target_node": "roles",
                "target_port": "dataset",
            },
            {
                "id": "roles-split",
                "source_node": "roles",
                "source_port": "labeled_dataset",
                "target_node": "split",
                "target_port": "labeled_dataset",
            },
        ],
    }
    first_graph = WorkflowGraph.model_validate(base)
    common = {
        "project_id": uuid4(),
        "project_dir": tmp_path,
        "allowed_import_roots": [bundled_dataset.parent],
        "target_node_ids": ["split"],
    }
    first = executor.execute(first_graph, **common)
    assert first.status == "succeeded"

    changed_graph = first_graph.model_copy(deep=True)
    roles = next(node for node in changed_graph.nodes if node.id == "roles")
    roles.config["features"] = ["age"]
    second = executor.execute(changed_graph, **common)
    split_result = next(result for result in second.node_results if result.node_id == "split")
    assert split_result.cache_hit is False
    split_artifact = executor.artifacts.get_latest("split", "split_dataset")
    assert split_artifact is not None
    assert split_artifact.value.x_train.columns.tolist() == ["age"]
