"""Runtime artifacts and deterministic fingerprints."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any
from uuid import UUID

import numpy as np
import pandas as pd

from .schemas import PortType


@dataclass(slots=True)
class DatasetArtifact:
    frame: pd.DataFrame
    source: dict[str, Any]
    fingerprint: str


@dataclass(slots=True)
class OverviewArtifact:
    summary: dict[str, Any]


@dataclass(slots=True)
class LabeledDatasetArtifact:
    frame: pd.DataFrame
    feature_columns: list[str]
    target_column: str
    task: str
    source: dict[str, Any]
    fingerprint: str


@dataclass(slots=True)
class SplitDatasetArtifact:
    x_train: pd.DataFrame
    x_test: pd.DataFrame
    y_train: pd.Series
    y_test: pd.Series
    task: str
    target_column: str
    source: dict[str, Any]
    split_metadata: dict[str, Any]


@dataclass(slots=True)
class PreparedDatasetArtifact:
    preprocessor: Any
    x_train: Any
    x_test: Any
    y_train: pd.Series
    y_test: pd.Series
    raw_train: pd.DataFrame
    raw_test: pd.DataFrame
    task: str
    target_column: str
    feature_columns: list[str]
    feature_schema: list[dict[str, Any]]
    preprocessing_metadata: dict[str, Any]
    source: dict[str, Any]


@dataclass(slots=True)
class ModelDefinitionArtifact:
    task: str
    algorithm: str
    parameters: dict[str, Any]


@dataclass(slots=True)
class TrainedModelArtifact:
    preprocessor: Any
    estimator: Any
    task: str
    algorithm: str
    parameters: dict[str, Any]
    feature_columns: list[str]
    feature_schema: list[dict[str, Any]]
    target_column: str
    test_matrix: Any
    test_target: pd.Series
    raw_test: pd.DataFrame
    training_metadata: dict[str, Any]

    def predict(
        self, rows: pd.DataFrame
    ) -> tuple[list[Any], list[dict[str, float]] | None, list[str] | None]:
        ordered = rows.loc[:, self.feature_columns]
        transformed = self.preprocessor.transform(ordered)
        if self.training_metadata.get("dense_model_input") and hasattr(transformed, "toarray"):
            transformed = transformed.toarray()
        predictions = [_json_scalar(value) for value in self.estimator.predict(transformed)]
        if not hasattr(self.estimator, "predict_proba"):
            return predictions, None, None
        raw_probabilities = self.estimator.predict_proba(transformed)
        classes = [str(value) for value in self.estimator.classes_]
        probabilities = [
            {label: float(probability) for label, probability in zip(classes, row, strict=True)}
            for row in raw_probabilities
        ]
        return predictions, probabilities, classes


@dataclass(slots=True)
class MetricsArtifact:
    task: str
    algorithm: str
    metrics: dict[str, Any]
    explanations: dict[str, dict[str, str]]
    diagnostics: dict[str, Any]


@dataclass(slots=True)
class ReportArtifact:
    html: str
    markdown: str
    json_report: dict[str, Any]
    generated_files: dict[str, str] = field(default_factory=dict)


@dataclass(slots=True)
class ArtifactEnvelope:
    type: PortType
    value: Any
    fingerprint: str
    run_id: UUID | None = None
    workflow_fingerprint: str | None = None


def _json_scalar(value: Any) -> Any:
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return value.isoformat()
    if pd.isna(value):
        return None
    return value


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, np.ndarray):
        return [json_safe(item) for item in value.tolist()]
    if isinstance(value, (np.generic, datetime, date, pd.Timestamp)):
        return _json_scalar(value)
    if isinstance(value, float) and not np.isfinite(value):
        return None
    if value is pd.NA:
        return None
    return value


def dataframe_fingerprint(frame: pd.DataFrame) -> str:
    digest = hashlib.sha256()
    digest.update(json.dumps(list(frame.columns), ensure_ascii=False).encode())
    digest.update(json.dumps([str(dtype) for dtype in frame.dtypes]).encode())
    row_hashes = pd.util.hash_pandas_object(frame, index=True, categorize=True).values
    digest.update(np.asarray(row_hashes).tobytes())
    return digest.hexdigest()


def fingerprint_value(value: Any) -> str:
    if isinstance(value, DatasetArtifact):
        return value.fingerprint
    if isinstance(value, LabeledDatasetArtifact):
        role_identity = {
            "dataset_fingerprint": value.fingerprint,
            "feature_columns": value.feature_columns,
            "target_column": value.target_column,
            "task": value.task,
            "source": value.source,
        }
        encoded = json.dumps(
            json_safe(role_identity), sort_keys=True, separators=(",", ":"), default=str
        )
        return hashlib.sha256(encoded.encode()).hexdigest()
    if isinstance(value, SplitDatasetArtifact):
        value = {
            "x_train": dataframe_fingerprint(value.x_train),
            "x_test": dataframe_fingerprint(value.x_test),
            "y_train": fingerprint_value(value.y_train),
            "y_test": fingerprint_value(value.y_test),
            "metadata": value.split_metadata,
        }
    if isinstance(value, PreparedDatasetArtifact):
        value = {
            "raw_train": dataframe_fingerprint(value.raw_train),
            "raw_test": dataframe_fingerprint(value.raw_test),
            "y_train": fingerprint_value(value.y_train),
            "y_test": fingerprint_value(value.y_test),
            "metadata": value.preprocessing_metadata,
        }
    if isinstance(value, TrainedModelArtifact):
        value = {
            "task": value.task,
            "algorithm": value.algorithm,
            "parameters": value.parameters,
            "feature_columns": value.feature_columns,
            "training_metadata": value.training_metadata,
        }
    if isinstance(value, (ModelDefinitionArtifact, OverviewArtifact, MetricsArtifact)):
        value = asdict(value)
    if isinstance(value, pd.DataFrame):
        return dataframe_fingerprint(value)
    if isinstance(value, pd.Series):
        hashes = np.asarray(pd.util.hash_pandas_object(value, index=True).values)
        return hashlib.sha256(hashes.tobytes()).hexdigest()
    if isinstance(value, ReportArtifact):
        value = value.json_report
    if hasattr(value, "__dict__"):
        value = {
            key: item
            for key, item in vars(value).items()
            if key not in {"preprocessor", "estimator", "x_train", "x_test", "test_matrix"}
        }
    try:
        encoded = json.dumps(json_safe(value), sort_keys=True, separators=(",", ":"), default=str)
    except (TypeError, ValueError):
        encoded = repr(value)
    return hashlib.sha256(encoded.encode()).hexdigest()


class ArtifactStore:
    """Process-local artifact cache; project metadata stays durable in SQLite.

    Model objects are intentionally not deserialized from pickle/joblib. A restarted
    backend requires rerunning training before interactive prediction.
    """

    def __init__(self) -> None:
        self._cache: dict[str, tuple[dict[str, ArtifactEnvelope], list[Any]]] = {}
        self._latest: dict[str, dict[str, ArtifactEnvelope]] = {}

    def get_cache(self, cache_key: str) -> tuple[dict[str, ArtifactEnvelope], list[Any]] | None:
        return self._cache.get(cache_key)

    def put_cache(
        self, cache_key: str, outputs: dict[str, ArtifactEnvelope], warnings: list[Any]
    ) -> None:
        self._cache[cache_key] = (outputs, list(warnings))

    def set_latest(self, node_id: str, outputs: dict[str, ArtifactEnvelope]) -> None:
        self._latest[node_id] = outputs

    def get_latest(
        self, node_id: str, port: str | None = None
    ) -> ArtifactEnvelope | dict[str, ArtifactEnvelope] | None:
        outputs = self._latest.get(node_id)
        if outputs is None or port is None:
            return outputs
        return outputs.get(port)

    def clear_latest(self, node_ids: set[str]) -> None:
        for node_id in node_ids:
            self._latest.pop(node_id, None)

    def all_latest(self) -> dict[str, dict[str, ArtifactEnvelope]]:
        return dict(self._latest)


def artifact_preview(value: Any, max_rows: int = 20) -> Any:
    if isinstance(value, DatasetArtifact):
        return {
            "rows": value.frame.head(max_rows).replace({np.nan: None}).to_dict(orient="records"),
            "row_count": len(value.frame),
            "column_count": len(value.frame.columns),
            "columns": list(value.frame.columns),
            "source": value.source,
        }
    if isinstance(value, LabeledDatasetArtifact):
        return {
            "row_count": len(value.frame),
            "features": value.feature_columns,
            "target": value.target_column,
            "task": value.task,
        }
    if isinstance(value, SplitDatasetArtifact):
        return value.split_metadata
    if isinstance(value, PreparedDatasetArtifact):
        return value.preprocessing_metadata
    if isinstance(value, TrainedModelArtifact):
        return {
            "task": value.task,
            "algorithm": value.algorithm,
            "parameters": value.parameters,
            "input_schema": value.feature_schema,
        }
    if isinstance(value, OverviewArtifact):
        return json_safe(value.summary)
    if isinstance(value, MetricsArtifact):
        return json_safe(
            {
                "task": value.task,
                "algorithm": value.algorithm,
                "metrics": value.metrics,
                "explanations": value.explanations,
                "diagnostics": value.diagnostics,
            }
        )
    if isinstance(value, ModelDefinitionArtifact):
        return json_safe(asdict(value))
    if isinstance(value, ReportArtifact):
        return {
            "formats": ["html", "markdown", "json"],
            "report": value.json_report,
            "generated_files": value.generated_files,
        }
    return json_safe(value)
