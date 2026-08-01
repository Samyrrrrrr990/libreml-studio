from __future__ import annotations

from pathlib import Path
from threading import Event
from uuid import uuid4

import pandas as pd
import pytest
from libreml_core.artifacts import DatasetArtifact, SplitDatasetArtifact, dataframe_fingerprint
from libreml_core.nodes import ExecutionContext
from libreml_core.security import ImportSecurityError, resolve_allowed_path
from libreml_nodes.data import (
    AssignRolesConfig,
    DatasetOverviewConfig,
    TabularPreprocessConfig,
    execute_assign_roles,
    execute_dataset_overview,
    execute_tabular_preprocess,
)
from libreml_nodes.ml import METRIC_EXPLANATIONS


def context(tmp_path: Path) -> ExecutionContext:
    return ExecutionContext(
        project_id=uuid4(),
        run_id=uuid4(),
        node_id="test",
        random_seed=42,
        project_dir=tmp_path,
        allowed_import_roots=[tmp_path],
        cancellation=Event(),
        progress=lambda *_: None,
        logger=lambda *_: None,
        environment={},
    )


def test_assign_roles_accepts_known_features_and_requires_explicit_task(tmp_path: Path) -> None:
    frame = pd.DataFrame({"x": [1, 2, 3], "group": ["a", "b", "a"], "y": [2.0, 4.0, 6.0]})
    dataset = DatasetArtifact(frame, {}, dataframe_fingerprint(frame))
    output = execute_assign_roles(
        AssignRolesConfig(target="y", features=["x", "group"], task="regression"),
        {"dataset": dataset},
        context(tmp_path),
    )
    assert output.values["labeled_dataset"].feature_columns == ["x", "group"]
    with pytest.raises(ValueError):
        AssignRolesConfig.model_validate({"target": "y", "features": ["x"]})


def test_preprocessing_fits_statistics_on_training_partition_only(tmp_path: Path) -> None:
    split = SplitDatasetArtifact(
        x_train=pd.DataFrame({"value": [1.0, 2.0, None], "kind": ["a", "b", None]}),
        x_test=pd.DataFrame({"value": [10_000.0], "kind": ["unseen"]}),
        y_train=pd.Series([0, 1, 0]),
        y_test=pd.Series([1]),
        task="classification",
        target_column="target",
        source={},
        split_metadata={},
    )
    output = execute_tabular_preprocess(
        TabularPreprocessConfig(), {"split_dataset": split}, context(tmp_path)
    )
    prepared = output.values["prepared_dataset"]
    numeric_pipeline = prepared.preprocessor.named_transformers_["numeric"]
    assert numeric_pipeline.named_steps["imputer"].statistics_[0] == pytest.approx(1.5)
    assert numeric_pipeline.named_steps["scaler"].mean_[0] == pytest.approx(1.5)
    assert prepared.preprocessing_metadata["fit_partition"] == "train_only"


def test_metric_explanations_cover_every_emitted_metric_name() -> None:
    emitted = {
        "mae",
        "mse",
        "rmse",
        "r_squared",
        "baseline_mae",
        "accuracy",
        "baseline_accuracy",
        "balanced_accuracy",
        "precision_macro",
        "recall_macro",
        "f1_macro",
        "log_loss",
        "roc_auc",
        "pr_auc",
    }
    assert emitted <= set(METRIC_EXPLANATIONS)
    assert all(
        {"measures", "direction", "caution", "baseline"} <= set(METRIC_EXPLANATIONS[name])
        for name in emitted
    )


def test_path_outside_allowed_root_is_rejected(tmp_path: Path) -> None:
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    outside = tmp_path / "secret.csv"
    outside.write_text("secret\nvalue\n", encoding="utf-8")
    with pytest.raises(ImportSecurityError):
        resolve_allowed_path(outside, [allowed])


def test_overview_only_findings_do_not_offer_unresolvable_automatic_repairs(
    tmp_path: Path,
) -> None:
    frame = pd.DataFrame(
        {
            "participant_id": [f"P{index:03d}" for index in range(25)],
            "constant": [1] * 25,
            "value": list(range(25)),
        }
    )
    dataset = DatasetArtifact(frame, {}, dataframe_fingerprint(frame))
    output = execute_dataset_overview(
        DatasetOverviewConfig(), {"dataset": dataset}, context(tmp_path)
    )
    relevant = {
        warning.code: warning
        for warning in output.warnings
        if warning.code in {"identifier_column", "constant_column"}
    }
    assert set(relevant) == {"identifier_column", "constant_column"}
    assert all(not warning.automatic_repair_available for warning in relevant.values())
    assert all(warning.repair_patch is None for warning in relevant.values())
