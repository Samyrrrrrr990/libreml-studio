from __future__ import annotations

import math
import warnings
from pathlib import Path
from threading import Event
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd
import pytest
from libreml_core.artifacts import (
    ModelDefinitionArtifact,
    SplitDatasetArtifact,
    TrainedModelArtifact,
)
from libreml_core.nodes import ExecutionContext
from libreml_nodes import data as data_nodes
from libreml_nodes.data import TabularPreprocessConfig, execute_tabular_preprocess
from libreml_nodes.ml import (
    ESTIMATOR_MAX_PARALLEL_JOBS,
    EvaluateModelConfig,
    _build_estimator,
    execute_evaluate_model,
)
from scipy import sparse
from sklearn.compose import ColumnTransformer


def _context(tmp_path: Path) -> ExecutionContext:
    return ExecutionContext(
        project_id=uuid4(),
        run_id=uuid4(),
        node_id="methodology-test",
        random_seed=17,
        project_dir=tmp_path,
        allowed_import_roots=[tmp_path],
        cancellation=Event(),
        progress=lambda *_: None,
        logger=lambda *_: None,
        environment={},
    )


class _FixedEstimator:
    def __init__(
        self,
        predictions: list[Any],
        *,
        classes: list[Any] | None = None,
        probabilities: list[list[float]] | None = None,
    ) -> None:
        self._predictions = np.asarray(predictions)
        if classes is not None:
            self.classes_ = np.asarray(classes)
        if probabilities is not None:
            self._probabilities = np.asarray(probabilities, dtype=float)

    def predict(self, matrix: Any) -> np.ndarray[Any, Any]:
        assert len(matrix) == len(self._predictions)
        return self._predictions

    def predict_proba(self, matrix: Any) -> np.ndarray[Any, Any]:
        assert len(matrix) == len(self._probabilities)
        return self._probabilities


def _trained_artifact(
    *,
    task: str,
    estimator: Any,
    y_true: list[Any],
    training_metadata: dict[str, Any],
) -> TrainedModelArtifact:
    rows = len(y_true)
    return TrainedModelArtifact(
        preprocessor=None,
        estimator=estimator,
        task=task,
        algorithm="fixed_reference_estimator",
        parameters={},
        feature_columns=["x"],
        feature_schema=[],
        target_column="target",
        test_matrix=np.zeros((rows, 1), dtype=float),
        test_target=pd.Series(y_true, name="target"),
        raw_test=pd.DataFrame({"x": np.arange(rows)}),
        training_metadata=training_metadata,
    )


def test_preprocessing_memory_projection_blocks_before_fit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    split = SplitDatasetArtifact(
        x_train=pd.DataFrame({"category": ["a", "b", "c", "d"]}),
        x_test=pd.DataFrame({"category": ["a"]}),
        y_train=pd.Series([0, 1, 0, 1]),
        y_test=pd.Series([0]),
        task="classification",
        target_column="target",
        source={},
        split_metadata={},
    )
    monkeypatch.setattr(data_nodes, "PREPROCESSING_MEMORY_BUDGET_BYTES", 1)

    def fail_if_fit_starts(*_args: Any, **_kwargs: Any) -> Any:
        raise AssertionError("fit_transform must not start after a failed memory preflight")

    monkeypatch.setattr(ColumnTransformer, "fit_transform", fail_if_fit_starts)
    with pytest.raises(ValueError, match="projected to need"):
        execute_tabular_preprocess(
            TabularPreprocessConfig(), {"split_dataset": split}, _context(tmp_path)
        )


def test_sparse_matrix_postcheck_counts_concrete_buffers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    matrix = sparse.csr_matrix(np.asarray([[1.0, 0.0, 2.0], [0.0, 3.0, 0.0]]))
    expected = matrix.data.nbytes + matrix.indices.nbytes + matrix.indptr.nbytes
    assert data_nodes._matrix_storage_bytes(matrix) == expected

    monkeypatch.setattr(data_nodes, "PREPROCESSING_MEMORY_BUDGET_BYTES", expected - 1)
    with pytest.raises(ValueError, match="transformed matrices use"):
        data_nodes._enforce_actual_matrix_budget(matrix)


@pytest.mark.parametrize(
    ("task", "algorithm"),
    [
        ("regression", "random_forest_regressor"),
        ("classification", "random_forest_classifier"),
    ],
)
def test_random_forest_parallelism_is_bounded(
    task: str, algorithm: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("libreml_nodes.ml.os.cpu_count", lambda: 128)
    estimator = _build_estimator(
        ModelDefinitionArtifact(task=task, algorithm=algorithm, parameters={}), seed=17
    )
    assert estimator.n_jobs == ESTIMATOR_MAX_PARALLEL_JOBS
    assert estimator.n_jobs != -1


def test_regression_metrics_match_hand_calculation(tmp_path: Path) -> None:
    trained = _trained_artifact(
        task="regression",
        estimator=_FixedEstimator([3.0, 5.0, 5.0]),
        y_true=[2.0, 4.0, 6.0],
        training_metadata={"target_mean": 3.0},
    )
    output = execute_evaluate_model(
        EvaluateModelConfig(), {"trained_model": trained}, _context(tmp_path)
    )
    metrics = output.values["metrics"].metrics

    assert metrics["mae"] == pytest.approx(1.0)
    assert metrics["mse"] == pytest.approx(1.0)
    assert metrics["rmse"] == pytest.approx(1.0)
    assert metrics["r_squared"] == pytest.approx(0.625)
    assert metrics["baseline_mae"] == pytest.approx(5.0 / 3.0)


@pytest.mark.parametrize(
    ("y_true", "reason"),
    [([4.0], "fewer_than_two_observations"), ([4.0, 4.0], "constant_holdout_target")],
)
def test_undefined_r_squared_is_none_with_structured_warning_and_no_library_warning(
    tmp_path: Path, y_true: list[float], reason: str
) -> None:
    trained = _trained_artifact(
        task="regression",
        estimator=_FixedEstimator([4.0] * len(y_true)),
        y_true=y_true,
        training_metadata={"target_mean": 4.0},
    )
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        output = execute_evaluate_model(
            EvaluateModelConfig(), {"trained_model": trained}, _context(tmp_path)
        )

    assert caught == []
    assert output.values["metrics"].metrics["r_squared"] is None
    finding = next(warning for warning in output.warnings if warning.code == "undefined_r_squared")
    assert finding.evidence["reason"] == reason


def test_binary_probability_metrics_name_average_precision_and_report_baselines(
    tmp_path: Path,
) -> None:
    probabilities = [[0.1, 0.9], [0.2, 0.8], [0.3, 0.7], [0.9, 0.1]]
    trained = _trained_artifact(
        task="classification",
        estimator=_FixedEstimator(
            ["yes", "yes", "yes", "no"],
            classes=["no", "yes"],
            probabilities=probabilities,
        ),
        y_true=["yes", "no", "yes", "no"],
        training_metadata={
            "training_majority_class": "no",
            "training_class_counts": {"no": 6, "yes": 4},
        },
    )
    output = execute_evaluate_model(
        EvaluateModelConfig(positive_class="yes"),
        {"trained_model": trained},
        _context(tmp_path),
    )
    artifact = output.values["metrics"]
    metrics = artifact.metrics

    # Positives rank first and third: AP = (precision@1 + precision@3) / 2.
    assert metrics["average_precision"] == pytest.approx((1.0 + 2.0 / 3.0) / 2.0)
    assert metrics["average_precision_baseline"] == pytest.approx(0.5)
    assert metrics["roc_auc"] == pytest.approx(0.75)
    expected_baseline_log_loss = -(2.0 * math.log(0.4) + 2.0 * math.log(0.6)) / 4.0
    assert metrics["baseline_log_loss"] == pytest.approx(expected_baseline_log_loss)
    assert "pr_auc" not in metrics
    assert "Average Precision" in artifact.explanations["average_precision"]["measures"]
    assert not any(warning.code == "implicit_positive_class" for warning in output.warnings)


def test_binary_positive_class_is_warned_when_implicit_and_rejected_when_unknown(
    tmp_path: Path,
) -> None:
    trained = _trained_artifact(
        task="classification",
        estimator=_FixedEstimator(
            ["yes", "no"],
            classes=["no", "yes"],
            probabilities=[[0.1, 0.9], [0.8, 0.2]],
        ),
        y_true=["yes", "no"],
        training_metadata={
            "training_majority_class": "no",
            "training_class_counts": {"no": 6, "yes": 4},
        },
    )
    output = execute_evaluate_model(
        EvaluateModelConfig(), {"trained_model": trained}, _context(tmp_path)
    )
    warning = next(item for item in output.warnings if item.code == "implicit_positive_class")
    assert warning.evidence["selected_positive_class"] == "yes"

    with pytest.raises(ValueError, match="not one of"):
        execute_evaluate_model(
            EvaluateModelConfig(positive_class="unknown"),
            {"trained_model": trained},
            _context(tmp_path),
        )


def test_multiclass_roc_auc_is_explicit_weighted_one_vs_rest_with_log_loss_baseline(
    tmp_path: Path,
) -> None:
    probabilities = [
        [0.9, 0.05, 0.05],
        [0.4, 0.3, 0.3],
        [0.2, 0.7, 0.1],
        [0.5, 0.4, 0.1],
        [0.2, 0.2, 0.6],
        [0.1, 0.6, 0.3],
    ]
    trained = _trained_artifact(
        task="classification",
        estimator=_FixedEstimator(
            ["a", "a", "b", "a", "c", "b"],
            classes=["a", "b", "c"],
            probabilities=probabilities,
        ),
        y_true=["a", "a", "b", "b", "c", "c"],
        training_metadata={
            "training_majority_class": "a",
            "training_class_counts": {"a": 3, "b": 2, "c": 1},
        },
    )
    output = execute_evaluate_model(
        EvaluateModelConfig(), {"trained_model": trained}, _context(tmp_path)
    )
    artifact = output.values["metrics"]
    metrics = artifact.metrics

    # Hand-ranked one-vs-rest AUCs are 7/8, 7/8, and 15/16; supports are equal.
    assert metrics["roc_auc_ovr_weighted"] == pytest.approx(
        ((7.0 / 8.0) + (7.0 / 8.0) + (15.0 / 16.0)) / 3.0
    )
    expected_baseline_log_loss = (
        -(2.0 * math.log(0.5) + 2.0 * math.log(1.0 / 3.0) + 2.0 * math.log(1.0 / 6.0)) / 6.0
    )
    assert metrics["baseline_log_loss"] == pytest.approx(expected_baseline_log_loss)
    assert "roc_auc" not in metrics
    explanation = artifact.explanations["roc_auc_ovr_weighted"]
    assert "weighted mean" in explanation["measures"]
    assert "one-vs-rest" in explanation["measures"]

    with pytest.raises(ValueError, match="applies only to binary"):
        execute_evaluate_model(
            EvaluateModelConfig(positive_class="a"),
            {"trained_model": trained},
            _context(tmp_path),
        )
