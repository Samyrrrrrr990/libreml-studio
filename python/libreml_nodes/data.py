"""Secure local data import, inspection, role assignment, split, and preprocessing."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from libreml_core.artifacts import (
    DatasetArtifact,
    LabeledDatasetArtifact,
    OverviewArtifact,
    PreparedDatasetArtifact,
    SplitDatasetArtifact,
    dataframe_fingerprint,
    json_safe,
)
from libreml_core.nodes import ExecutionContext, NodeExecutionOutput
from libreml_core.schemas import Severity, ValidationIssue
from libreml_core.security import (
    enforce_file_size,
    inspect_excel_archive,
    resolve_allowed_path,
    sha256_file,
)
from pydantic import BaseModel, ConfigDict, Field, model_validator
from scipy import sparse, stats
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

PREPROCESSING_MEMORY_BUDGET_BYTES = 512 * 1024 * 1024
"""Maximum projected working set and retained transformed-matrix storage."""

_PREPROCESSING_WORKING_SET_MULTIPLIER = 3
_PROJECTED_SPARSE_VALUE_BYTES = 8
_PROJECTED_SPARSE_INDEX_BYTES = 8
_PROJECTED_CATEGORY_METADATA_BYTES = 128


class NodeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CSVImportConfig(NodeConfig):
    path: str = Field(min_length=1, max_length=4096)
    delimiter: Literal[",", ";", "\t", "|"] = ","
    encoding: Literal["utf-8", "utf-8-sig", "latin-1"] = "utf-8"
    max_rows: int = Field(default=1_000_000, ge=1, le=2_000_000)


class ExcelImportConfig(NodeConfig):
    path: str = Field(min_length=1, max_length=4096)
    sheet_name: str | int = 0
    max_rows: int = Field(default=250_000, ge=1, le=500_000)


class ParquetImportConfig(NodeConfig):
    path: str = Field(min_length=1, max_length=4096)
    columns: list[str] | None = None
    max_rows: int = Field(default=1_000_000, ge=1, le=2_000_000)


class DatasetOverviewConfig(NodeConfig):
    preview_rows: int = Field(default=20, ge=1, le=200)
    confidence_level: float = Field(default=0.95, ge=0.8, le=0.999)


class AssignRolesConfig(NodeConfig):
    target: str = Field(min_length=1)
    features: list[str] | None = None
    ignored: list[str] = Field(default_factory=list)
    task: Literal["regression", "classification"]

    @model_validator(mode="after")
    def disjoint_roles(self) -> AssignRolesConfig:
        if self.target in self.ignored:
            raise ValueError("The target cannot also be ignored")
        if self.features is not None and self.target in self.features:
            raise ValueError("The target cannot also be a feature")
        if self.features is not None and set(self.features) & set(self.ignored):
            raise ValueError("A column cannot be both a feature and ignored")
        return self


class TrainTestSplitConfig(NodeConfig):
    test_size: float = Field(default=0.2, ge=0.1, le=0.5)
    strategy: Literal["auto", "random", "stratified"] = "auto"
    random_seed: int | None = Field(default=None, ge=0, le=2**32 - 1)


class TabularPreprocessConfig(NodeConfig):
    numeric_imputation: Literal["median", "mean"] = "median"
    categorical_imputation: Literal["most_frequent"] = "most_frequent"
    scale_numeric: bool = True
    max_categories_per_feature: int = Field(default=100, ge=2, le=1000)


def _local_path(configured_path: str, context: ExecutionContext, extensions: set[str]) -> Path:
    if configured_path.startswith("bundled:"):
        bundled_name = configured_path.removeprefix("bundled:")
        if Path(bundled_name).name != bundled_name or not context.allowed_import_roots:
            raise ValueError("Invalid bundled dataset reference")
        candidate = context.allowed_import_roots[-1] / bundled_name
    else:
        candidate = Path(configured_path)
        if not candidate.is_absolute():
            candidate = context.project_dir / candidate
    path = resolve_allowed_path(candidate, context.allowed_import_roots)
    if path.suffix.lower() not in extensions:
        raise ValueError(
            f"Expected one of {sorted(extensions)}; received '{path.suffix or 'no extension'}'"
        )
    enforce_file_size(path)
    return path


def _dataset(frame: pd.DataFrame, path: Path, source_type: str) -> DatasetArtifact:
    if frame.empty:
        raise ValueError("The imported dataset has no rows")
    if frame.columns.empty:
        raise ValueError("The imported dataset has no columns")
    normalized = [str(column).strip() for column in frame.columns]
    if any(not column for column in normalized):
        raise ValueError("Every column must have a non-empty name")
    if len(normalized) != len(set(normalized)):
        raise ValueError("Duplicate column names are not supported; rename them before import")
    frame = frame.copy()
    frame.columns = normalized
    fingerprint = dataframe_fingerprint(frame)
    source = {
        "type": source_type,
        "filename": path.name,
        "file_sha256": sha256_file(path),
        "dataset_fingerprint": fingerprint,
        "size_bytes": path.stat().st_size,
    }
    return DatasetArtifact(frame=frame, source=source, fingerprint=fingerprint)


def execute_csv_import(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, CSVImportConfig)
    del inputs
    context.progress(context.node_id, 0.1, "Validating local CSV")
    path = _local_path(config.path, context, {".csv", ".tsv"})
    frame = pd.read_csv(
        path,
        sep=config.delimiter,
        encoding=config.encoding,
        nrows=config.max_rows + 1,
        low_memory=False,
    )
    if len(frame) > config.max_rows:
        raise ValueError(f"The CSV exceeds the configured {config.max_rows:,}-row safety limit")
    context.progress(context.node_id, 1.0, "CSV imported locally")
    return NodeExecutionOutput(values={"dataset": _dataset(frame, path, "csv")})


def execute_excel_import(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, ExcelImportConfig)
    del inputs
    path = _local_path(config.path, context, {".xlsx", ".xlsm"})
    inspect_excel_archive(path)
    frame = pd.read_excel(
        path,
        sheet_name=config.sheet_name,
        engine="openpyxl",
        nrows=config.max_rows + 1,
        engine_kwargs={"read_only": True, "data_only": True},
    )
    if not isinstance(frame, pd.DataFrame):
        raise ValueError("Select exactly one spreadsheet sheet")
    if len(frame) > config.max_rows:
        raise ValueError(f"The spreadsheet exceeds the configured {config.max_rows:,}-row limit")
    return NodeExecutionOutput(values={"dataset": _dataset(frame, path, "excel")})


def execute_parquet_import(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, ParquetImportConfig)
    del inputs
    path = _local_path(config.path, context, {".parquet", ".pq"})
    parquet = pq.ParquetFile(path)
    if parquet.metadata.num_rows > config.max_rows:
        raise ValueError(
            f"The Parquet file has {parquet.metadata.num_rows:,} rows; limit is {config.max_rows:,}"
        )
    if parquet.metadata.num_columns > 10_000:
        raise ValueError("The Parquet file exceeds the 10,000-column safety limit")
    uncompressed = sum(
        parquet.metadata.row_group(group).column(column).total_uncompressed_size
        for group in range(parquet.metadata.num_row_groups)
        for column in range(parquet.metadata.row_group(group).num_columns)
    )
    if uncompressed > 1024 * 1024 * 1024:
        raise ValueError("The Parquet file expands beyond the 1 GiB import safety limit")
    if any(pa.types.is_nested(field.type) for field in parquet.schema_arrow):
        raise ValueError("Nested Parquet fields are not supported in the tabular workflow")
    frame = parquet.read(columns=config.columns).to_pandas()
    return NodeExecutionOutput(values={"dataset": _dataset(frame, path, "parquet")})


def _numeric_summary(series: pd.Series, confidence_level: float) -> dict[str, Any]:
    clean = pd.to_numeric(series, errors="coerce").dropna().astype(float)
    if clean.empty:
        return {}
    quartiles = clean.quantile([0.25, 0.5, 0.75])
    result: dict[str, Any] = {
        "mean": float(clean.mean()),
        "median": float(clean.median()),
        "minimum": float(clean.min()),
        "maximum": float(clean.max()),
        "range": float(clean.max() - clean.min()),
        "variance": float(clean.var(ddof=1)) if len(clean) > 1 else None,
        "standard_deviation": float(clean.std(ddof=1)) if len(clean) > 1 else None,
        "q1": float(quartiles.loc[0.25]),
        "q3": float(quartiles.loc[0.75]),
        "interquartile_range": float(quartiles.loc[0.75] - quartiles.loc[0.25]),
        "skewness": float(np.asarray(clean.skew()).item()) if len(clean) > 2 else None,
        "kurtosis": float(np.asarray(clean.kurt()).item()) if len(clean) > 3 else None,
    }
    if len(clean) > 1:
        standard_error = float(stats.sem(clean))
        if standard_error == 0:
            mean = float(clean.mean())
            result["mean_confidence_interval"] = [mean, mean]
        elif np.isfinite(standard_error):
            interval = stats.t.interval(
                confidence_level, len(clean) - 1, loc=clean.mean(), scale=standard_error
            )
            result["mean_confidence_interval"] = [float(interval[0]), float(interval[1])]
        else:
            result["mean_confidence_interval"] = None
        result["confidence_level"] = confidence_level
    safe_result = json_safe(result)
    if not isinstance(safe_result, dict):
        raise TypeError("Numeric summary must be a mapping")
    return safe_result


def _overview_warning(
    code: str,
    title: str,
    plain: str,
    technical: str,
    evidence: dict[str, Any],
    repair: str,
    *,
    severity: Severity = Severity.WARNING,
    automatic: bool = False,
    patch: dict[str, Any] | None = None,
) -> ValidationIssue:
    return ValidationIssue(
        code=code,
        severity=severity,
        title=title,
        plain_explanation=plain,
        technical_explanation=technical,
        evidence=evidence,
        likely_consequence="Results may be unstable, misleading, or fail to generalize.",
        recommended_repair=repair,
        automatic_repair_available=automatic,
        node_ids=[],
        repair_patch=patch,
    )


def execute_dataset_overview(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, DatasetOverviewConfig)
    dataset = inputs["dataset"]
    assert isinstance(dataset, DatasetArtifact)
    frame = dataset.frame
    columns: list[dict[str, Any]] = []
    warnings: list[ValidationIssue] = []
    for name in frame.columns:
        series = frame[name]
        non_missing = series.dropna()
        modes = non_missing.mode().head(3).tolist()
        column = {
            "name": name,
            "dtype": str(series.dtype),
            "count": int(series.count()),
            "missing_count": int(series.isna().sum()),
            "missing_percentage": float(series.isna().mean() * 100),
            "unique_count": int(series.nunique(dropna=True)),
            "mode": json_safe(modes),
        }
        if pd.api.types.is_numeric_dtype(series):
            column["numeric"] = _numeric_summary(series, config.confidence_level)
        else:
            frequencies = non_missing.astype(str).value_counts(dropna=False).head(20)
            column["frequencies"] = {str(key): int(value) for key, value in frequencies.items()}
        columns.append(column)
        missing_fraction = float(series.isna().mean())
        if missing_fraction >= 0.4:
            warnings.append(
                _overview_warning(
                    "excessive_missingness",
                    f"High missingness in {name}",
                    f"{missing_fraction:.1%} of '{name}' is missing.",
                    "A feature with substantial missingness can make imputation assumptions dominate the model.",
                    {"column": name, "missing_fraction": missing_fraction},
                    "Review how the values became missing; consider excluding the field or use a justified training-only imputation strategy.",
                )
            )
        unique = int(series.nunique(dropna=True))
        if unique <= 1:
            warnings.append(
                _overview_warning(
                    "constant_column",
                    f"Constant column: {name}",
                    f"'{name}' does not vary and cannot help prediction.",
                    "Zero-variance predictors provide no estimable signal.",
                    {"column": name, "unique_count": unique},
                    "Exclude this column from the feature role.",
                )
            )
        if (
            len(frame) >= 20
            and unique / len(frame) >= 0.98
            and (name.lower() in {"id", "uuid", "index"} or name.lower().endswith("_id"))
        ):
            warnings.append(
                _overview_warning(
                    "identifier_column",
                    f"Possible identifier: {name}",
                    f"'{name}' appears to identify rows rather than describe them.",
                    "Near-unique identifiers can let flexible models memorize records.",
                    {"column": name, "unique_ratio": unique / len(frame)},
                    "Mark this column as ignored unless it has a defensible predictive meaning.",
                )
            )
    duplicate_count = int(frame.duplicated().sum())
    if duplicate_count:
        warnings.append(
            _overview_warning(
                "duplicate_rows",
                "Duplicate rows detected",
                f"The dataset contains {duplicate_count:,} duplicated rows.",
                "Duplicates can cross partitions and inflate validation performance.",
                {"duplicate_rows": duplicate_count},
                "Investigate why the duplicates exist; if they are accidental, approve a deduplication step before splitting.",
            )
        )
    summary = {
        "row_count": len(frame),
        "column_count": len(frame.columns),
        "memory_bytes": int(frame.memory_usage(index=True, deep=True).sum()),
        "duplicate_rows": duplicate_count,
        "source": dataset.source,
        "columns": columns,
        "preview": json_safe(
            frame.head(config.preview_rows).replace({np.nan: None}).to_dict(orient="records")
        ),
        "sampled": False,
    }
    return NodeExecutionOutput(
        values={"dataset": dataset, "overview": OverviewArtifact(summary)}, warnings=warnings
    )


def execute_assign_roles(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, AssignRolesConfig)
    dataset = inputs["dataset"]
    assert isinstance(dataset, DatasetArtifact)
    frame = dataset.frame
    if config.target not in frame.columns:
        raise ValueError(f"Target column '{config.target}' does not exist")
    if frame[config.target].isna().any():
        raise ValueError(
            "The target contains missing values. Add an explicit target-row handling decision before assigning roles."
        )
    features = config.features or [
        column
        for column in frame.columns
        if column != config.target and column not in config.ignored
    ]
    if not features:
        raise ValueError("Select at least one feature")
    unknown = (set(features) | set(config.ignored)) - set(frame.columns)
    if unknown:
        raise ValueError(f"Unknown role columns: {sorted(unknown)}")
    if len(features) != len(set(features)):
        raise ValueError("Feature columns must be unique")
    task = config.task
    if task == "regression" and not pd.api.types.is_numeric_dtype(frame[config.target]):
        raise ValueError("Regression requires a numeric target")
    if task == "classification" and frame[config.target].nunique() < 2:
        raise ValueError("Classification requires at least two target classes")
    warnings: list[ValidationIssue] = []
    for feature in features:
        if frame[feature].equals(frame[config.target]):
            warnings.append(
                _overview_warning(
                    "direct_target_leakage",
                    f"Target leakage through {feature}",
                    f"'{feature}' exactly reproduces the target.",
                    "An input identical to the outcome makes holdout evaluation invalid.",
                    {"feature": feature, "target": config.target, "matching_rows": len(frame)},
                    f"Remove '{feature}' from the feature role.",
                    severity=Severity.BLOCKING,
                    automatic=True,
                    patch={"action": "remove_feature", "column": feature},
                )
            )
        lowered = feature.lower()
        if any(
            token in lowered for token in ("outcome", "target", "label", "post_event", "after_")
        ):
            warnings.append(
                _overview_warning(
                    "possible_target_leakage",
                    f"Review possible leakage: {feature}",
                    f"The name '{feature}' suggests it may be recorded after or derived from the outcome.",
                    "Name-based leakage screening cannot establish measurement timing, so domain review is required.",
                    {"feature": feature, "matched_heuristic": True},
                    "Confirm when this value becomes available. Remove it if it is unavailable at prediction time.",
                    severity=Severity.CAUTION,
                )
            )
    if any(warning.severity == Severity.BLOCKING for warning in warnings):
        # The artifact is emitted so the UI can explain and propose a repair, but later execution is blocked by the executor API.
        context.logger(
            "warning",
            "Direct target leakage detected",
            {
                "columns": [
                    warning.evidence.get("feature")
                    for warning in warnings
                    if warning.code == "direct_target_leakage"
                ]
            },
        )
    artifact = LabeledDatasetArtifact(
        frame=frame,
        feature_columns=features,
        target_column=config.target,
        task=task,
        source=dataset.source,
        fingerprint=dataset.fingerprint,
    )
    return NodeExecutionOutput(values={"labeled_dataset": artifact}, warnings=warnings)


def execute_train_test_split(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, TrainTestSplitConfig)
    labeled = inputs["labeled_dataset"]
    assert isinstance(labeled, LabeledDatasetArtifact)
    seed = context.random_seed if config.random_seed is None else config.random_seed
    strategy = (
        "stratified"
        if config.strategy == "auto" and labeled.task == "classification"
        else config.strategy
    )
    if strategy == "auto":
        strategy = "random"
    if strategy == "stratified" and labeled.task != "classification":
        raise ValueError("Stratified splitting is currently supported for classification targets")
    x = labeled.frame.loc[:, labeled.feature_columns]
    y = labeled.frame.loc[:, labeled.target_column]
    stratify = y if strategy == "stratified" else None
    if stratify is not None and y.value_counts().min() < 2:
        raise ValueError("Every class needs at least two observations for a stratified split")
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=config.test_size, random_state=seed, stratify=stratify
    )
    if labeled.task == "classification":
        all_classes = set(y.unique())
        missing_train = all_classes - set(y_train.unique())
        missing_test = all_classes - set(y_test.unique())
        if missing_train or missing_test:
            raise ValueError(
                f"The split does not preserve every class in both partitions (missing from train: {sorted(map(str, missing_train))}; missing from test: {sorted(map(str, missing_test))}). Use stratification or collect more observations."
            )
    warnings: list[ValidationIssue] = []
    train_hashes = set(
        pd.util.hash_pandas_object(pd.concat([x_train, y_train], axis=1), index=False)
    )
    test_hashes = set(pd.util.hash_pandas_object(pd.concat([x_test, y_test], axis=1), index=False))
    overlap = len(train_hashes & test_hashes)
    if overlap:
        warnings.append(
            _overview_warning(
                "duplicates_cross_split",
                "Duplicate records cross the holdout boundary",
                f"At least {overlap} distinct duplicated records occur in both training and test partitions.",
                "Information duplicated across partitions can inflate measured generalization.",
                {"overlapping_record_hashes": overlap},
                "Investigate duplicates and approve an explicit deduplication or group-aware split before using final metrics.",
            )
        )
    metadata = {
        "strategy": strategy,
        "random_seed": seed,
        "test_fraction": config.test_size,
        "train_rows": len(x_train),
        "test_rows": len(x_test),
        "target": labeled.target_column,
        "task": labeled.task,
    }
    artifact = SplitDatasetArtifact(
        x_train=x_train,
        x_test=x_test,
        y_train=y_train,
        y_test=y_test,
        task=labeled.task,
        target_column=labeled.target_column,
        source=labeled.source,
        split_metadata=metadata,
    )
    return NodeExecutionOutput(values={"split_dataset": artifact}, warnings=warnings)


def _feature_schema(
    train: pd.DataFrame, numeric: list[str], categorical: list[str]
) -> list[dict[str, Any]]:
    schema: list[dict[str, Any]] = []
    for column in train.columns:
        if column in numeric:
            clean = pd.to_numeric(train[column], errors="coerce")
            schema.append(
                {
                    "name": column,
                    "kind": "number",
                    "required": False,
                    "minimum_observed": json_safe(clean.min()),
                    "maximum_observed": json_safe(clean.max()),
                    "default": json_safe(clean.median()),
                }
            )
        else:
            categories = sorted(str(value) for value in train[column].dropna().unique())
            schema.append(
                {
                    "name": column,
                    "kind": "category",
                    "required": False,
                    "categories": categories,
                    "default": categories[0] if categories else None,
                }
            )
    return schema


def _projected_preprocessing_bytes(
    *,
    train_rows: int,
    test_rows: int,
    numeric_feature_count: int,
    categorical_cardinalities: list[int],
) -> tuple[int, int, str]:
    """Conservatively project preprocessing storage before fitting learned transforms.

    Cardinality determines the one-hot output width. The sparse estimate assumes every
    source feature contributes a non-zero value per row and uses 64-bit indices even
    though SciPy will commonly use 32-bit indices. The working-set multiplier accounts
    for transformer intermediates and the final combined matrix.
    """

    categorical_output_count = sum(max(cardinality, 1) for cardinality in categorical_cardinalities)
    output_feature_count = numeric_feature_count + categorical_output_count
    total_rows = train_rows + test_rows
    source_feature_count = numeric_feature_count + len(categorical_cardinalities)

    # ColumnTransformer returns dense output if there is no categorical expansion and
    # the combined density can be one; otherwise sparse_threshold=1.0 keeps it sparse.
    projected_format = (
        "sparse"
        if categorical_cardinalities and output_feature_count > source_feature_count
        else "dense"
    )
    if projected_format == "sparse":
        projected_nonzero = total_rows * source_feature_count
        retained_matrix_bytes = (
            projected_nonzero * (_PROJECTED_SPARSE_VALUE_BYTES + _PROJECTED_SPARSE_INDEX_BYTES)
            + (total_rows + 2) * _PROJECTED_SPARSE_INDEX_BYTES
        )
    else:
        retained_matrix_bytes = total_rows * output_feature_count * np.dtype(np.float64).itemsize

    category_metadata_bytes = categorical_output_count * _PROJECTED_CATEGORY_METADATA_BYTES
    projected_working_bytes = (
        retained_matrix_bytes * _PREPROCESSING_WORKING_SET_MULTIPLIER + category_metadata_bytes
    )
    return projected_working_bytes, output_feature_count, projected_format


def _matrix_storage_bytes(matrix: Any) -> int:
    """Return bytes retained by a dense array or the concrete buffers of a sparse matrix."""

    if sparse.issparse(matrix):
        total = int(matrix.data.nbytes)
        for attribute in ("indices", "indptr", "row", "col"):
            buffer = getattr(matrix, attribute, None)
            if buffer is not None:
                total += int(buffer.nbytes)
        return total
    array = np.asarray(matrix)
    return int(array.nbytes)


def _enforce_actual_matrix_budget(*matrices: Any) -> int:
    actual_bytes = sum(_matrix_storage_bytes(matrix) for matrix in matrices)
    if actual_bytes > PREPROCESSING_MEMORY_BUDGET_BYTES:
        actual_mib = actual_bytes / (1024 * 1024)
        budget_mib = PREPROCESSING_MEMORY_BUDGET_BYTES / (1024 * 1024)
        raise ValueError(
            "The transformed matrices use "
            f"{actual_mib:.1f} MiB, above the {budget_mib:.0f} MiB preprocessing "
            "safety budget. Reduce rows, features, or categorical levels."
        )
    return actual_bytes


def execute_tabular_preprocess(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, TabularPreprocessConfig)
    split = inputs["split_dataset"]
    assert isinstance(split, SplitDatasetArtifact)
    numeric = [
        column
        for column in split.x_train.columns
        if pd.api.types.is_numeric_dtype(split.x_train[column])
    ]
    categorical = [column for column in split.x_train.columns if column not in numeric]
    warnings: list[ValidationIssue] = []
    categorical_cardinalities: list[int] = []
    for column in categorical:
        cardinality = int(split.x_train[column].nunique(dropna=True))
        categorical_cardinalities.append(cardinality)
        if cardinality > config.max_categories_per_feature:
            raise ValueError(
                f"Categorical feature '{column}' has {cardinality} training categories, above the configured limit of {config.max_categories_per_feature}"
            )
        if cardinality > 30:
            warnings.append(
                _overview_warning(
                    "high_cardinality_category",
                    f"High-cardinality category: {column}",
                    f"'{column}' has {cardinality} categories in the training partition.",
                    "One-hot encoding many levels increases dimensionality and may overfit.",
                    {"column": column, "training_categories": cardinality},
                    "Review whether rare levels can be combined based on domain knowledge.",
                )
            )
    projected_bytes, projected_features, projected_format = _projected_preprocessing_bytes(
        train_rows=len(split.x_train),
        test_rows=len(split.x_test),
        numeric_feature_count=len(numeric),
        categorical_cardinalities=categorical_cardinalities,
    )
    if projected_bytes > PREPROCESSING_MEMORY_BUDGET_BYTES:
        projected_mib = projected_bytes / (1024 * 1024)
        budget_mib = PREPROCESSING_MEMORY_BUDGET_BYTES / (1024 * 1024)
        raise ValueError(
            "Preprocessing is projected to need "
            f"{projected_mib:.1f} MiB for {projected_features:,} output features "
            f"({projected_format}), above the {budget_mib:.0f} MiB safety budget. "
            "Reduce rows, features, or categorical levels before fitting."
        )
    numeric_steps: list[tuple[str, Any]] = [
        ("imputer", SimpleImputer(strategy=config.numeric_imputation, keep_empty_features=True))
    ]
    if config.scale_numeric:
        numeric_steps.append(("scaler", StandardScaler()))
    numeric_pipeline = Pipeline(numeric_steps)
    categorical_pipeline = Pipeline(
        [
            (
                "imputer",
                SimpleImputer(strategy=config.categorical_imputation, keep_empty_features=True),
            ),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=True)),
        ]
    )
    transformers: list[tuple[str, Any, list[str]]] = []
    if numeric:
        transformers.append(("numeric", numeric_pipeline, numeric))
    if categorical:
        transformers.append(("categorical", categorical_pipeline, categorical))
    if not transformers:
        raise ValueError("No usable feature columns were found")
    preprocessor = ColumnTransformer(
        transformers=transformers,
        remainder="drop",
        verbose_feature_names_out=True,
        sparse_threshold=1.0,
    )
    context.check_cancelled()
    context.progress(context.node_id, 0.2, "Fitting preprocessing on the training partition only")
    x_train = preprocessor.fit_transform(split.x_train)
    _enforce_actual_matrix_budget(x_train)
    context.check_cancelled()
    x_test = preprocessor.transform(split.x_test)
    actual_matrix_bytes = _enforce_actual_matrix_budget(x_train, x_test)
    metadata = {
        "fit_partition": "train_only",
        "numeric_features": numeric,
        "categorical_features": categorical,
        "numeric_imputation": config.numeric_imputation,
        "categorical_imputation": config.categorical_imputation,
        "scaled_numeric": config.scale_numeric,
        "output_feature_count": int(x_train.shape[1]),
        "projected_output_feature_count": projected_features,
        "projected_matrix_format": projected_format,
        "projected_working_set_bytes": projected_bytes,
        "actual_transformed_matrix_bytes": actual_matrix_bytes,
        "train_rows": int(x_train.shape[0]),
        "test_rows": int(x_test.shape[0]),
    }
    artifact = PreparedDatasetArtifact(
        preprocessor=preprocessor,
        x_train=x_train,
        x_test=x_test,
        y_train=split.y_train,
        y_test=split.y_test,
        raw_train=split.x_train,
        raw_test=split.x_test,
        task=split.task,
        target_column=split.target_column,
        feature_columns=list(split.x_train.columns),
        feature_schema=_feature_schema(split.x_train, numeric, categorical),
        preprocessing_metadata=metadata,
        source=split.source,
    )
    context.progress(
        context.node_id, 1.0, "Applied the fitted training transformation to the test partition"
    )
    return NodeExecutionOutput(values={"prepared_dataset": artifact}, warnings=warnings)
