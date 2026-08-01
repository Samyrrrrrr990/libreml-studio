"""Transparent model selection, training, and evaluation nodes."""

from __future__ import annotations

import math
import os
from typing import Any, Literal

import numpy as np
import pandas as pd
from libreml_core.artifacts import (
    MetricsArtifact,
    ModelDefinitionArtifact,
    PreparedDatasetArtifact,
    TrainedModelArtifact,
    json_safe,
)
from libreml_core.nodes import ExecutionContext, NodeExecutionOutput
from libreml_core.schemas import Severity, ValidationIssue
from pydantic import BaseModel, ConfigDict, Field, model_validator
from scipy import sparse
from sklearn.base import BaseEstimator
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import ElasticNet, Lasso, LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    log_loss,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_fscore_support,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

REGRESSION_ALGORITHMS = {
    "linear_regression",
    "ridge_regression",
    "lasso_regression",
    "elastic_net",
    "decision_tree_regressor",
    "random_forest_regressor",
    "gradient_boosting_regressor",
}
CLASSIFICATION_ALGORITHMS = {
    "logistic_regression",
    "decision_tree_classifier",
    "random_forest_classifier",
    "gradient_boosting_classifier",
    "support_vector_classifier",
    "k_nearest_neighbors_classifier",
}

ESTIMATOR_MAX_PARALLEL_JOBS = 4
"""Upper bound for estimator-owned worker pools on a local workstation."""


class NodeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ModelDefinitionConfig(NodeConfig):
    task: Literal["regression", "classification"]
    algorithm: str
    parameters: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def compatible_algorithm(self) -> ModelDefinitionConfig:
        allowed = REGRESSION_ALGORITHMS if self.task == "regression" else CLASSIFICATION_ALGORITHMS
        if self.algorithm not in allowed:
            raise ValueError(f"'{self.algorithm}' is not a supported {self.task} algorithm")
        return self


class TrainModelConfig(NodeConfig):
    random_seed: int | None = Field(default=None, ge=0, le=2**32 - 1)


class EvaluateModelConfig(NodeConfig):
    positive_class: str | int | float | bool | None = None


def _warning(
    code: str,
    title: str,
    plain: str,
    technical: str,
    evidence: dict[str, Any],
    repair: str,
    severity: Severity = Severity.WARNING,
) -> ValidationIssue:
    return ValidationIssue(
        code=code,
        severity=severity,
        title=title,
        plain_explanation=plain,
        technical_explanation=technical,
        evidence=evidence,
        likely_consequence="The reported performance may not represent future or minority-group performance.",
        recommended_repair=repair,
        automatic_repair_available=False,
    )


def execute_model_definition(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, ModelDefinitionConfig)
    del inputs, context
    _validated_parameters(config.task, config.algorithm, config.parameters)
    return NodeExecutionOutput(
        values={
            "model_definition": ModelDefinitionArtifact(
                task=config.task, algorithm=config.algorithm, parameters=config.parameters
            )
        }
    )


def _bounded_int(
    parameters: dict[str, Any], name: str, default: int, minimum: int, maximum: int
) -> int:
    value = parameters.get(name, default)
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(f"'{name}' must be an integer from {minimum} to {maximum}")
    return int(value)


def _bounded_float(
    parameters: dict[str, Any],
    name: str,
    default: float,
    minimum: float,
    maximum: float,
    *,
    inclusive_minimum: bool = True,
) -> float:
    value = parameters.get(name, default)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"'{name}' must be numeric")
    converted = float(value)
    valid_min = converted >= minimum if inclusive_minimum else converted > minimum
    if not valid_min or converted > maximum:
        qualifier = "at least" if inclusive_minimum else "greater than"
        raise ValueError(f"'{name}' must be {qualifier} {minimum} and at most {maximum}")
    return converted


def _validated_parameters(task: str, algorithm: str, supplied: dict[str, Any]) -> dict[str, Any]:
    common_tree = {"max_depth", "min_samples_split", "min_samples_leaf"}
    allowed: dict[str, set[str]] = {
        "linear_regression": {"fit_intercept"},
        "ridge_regression": {"alpha", "fit_intercept"},
        "lasso_regression": {"alpha", "fit_intercept", "max_iter"},
        "elastic_net": {"alpha", "l1_ratio", "fit_intercept", "max_iter"},
        "decision_tree_regressor": common_tree,
        "random_forest_regressor": common_tree | {"n_estimators", "max_features"},
        "gradient_boosting_regressor": {
            "n_estimators",
            "learning_rate",
            "max_depth",
            "min_samples_split",
            "min_samples_leaf",
        },
        "logistic_regression": {"C", "max_iter", "class_weight"},
        "decision_tree_classifier": common_tree | {"class_weight"},
        "random_forest_classifier": common_tree | {"n_estimators", "max_features", "class_weight"},
        "gradient_boosting_classifier": {
            "n_estimators",
            "learning_rate",
            "max_depth",
            "min_samples_split",
            "min_samples_leaf",
        },
        "support_vector_classifier": {"C", "kernel", "gamma", "class_weight"},
        "k_nearest_neighbors_classifier": {"n_neighbors", "weights", "p"},
    }
    unknown = set(supplied) - allowed[algorithm]
    if unknown:
        raise ValueError(f"Unsupported parameters for {algorithm}: {sorted(unknown)}")
    result = dict(supplied)
    if "fit_intercept" in result and not isinstance(result["fit_intercept"], bool):
        raise ValueError("'fit_intercept' must be true or false")
    if algorithm in {"ridge_regression", "lasso_regression", "elastic_net"}:
        result["alpha"] = _bounded_float(result, "alpha", 1.0, 0.0, 1_000_000.0)
    if algorithm == "elastic_net":
        result["l1_ratio"] = _bounded_float(result, "l1_ratio", 0.5, 0.0, 1.0)
    if "max_iter" in allowed[algorithm]:
        result["max_iter"] = _bounded_int(result, "max_iter", 2_000, 100, 100_000)
    if "n_estimators" in allowed[algorithm]:
        result["n_estimators"] = _bounded_int(result, "n_estimators", 200, 10, 2_000)
    if "learning_rate" in allowed[algorithm]:
        result["learning_rate"] = _bounded_float(result, "learning_rate", 0.1, 0.0001, 10.0)
    if "max_depth" in allowed[algorithm] and "max_depth" in result:
        result["max_depth"] = _bounded_int(result, "max_depth", 3, 1, 100)
    if "min_samples_split" in allowed[algorithm] and "min_samples_split" in result:
        result["min_samples_split"] = _bounded_int(result, "min_samples_split", 2, 2, 10_000)
    if "min_samples_leaf" in allowed[algorithm] and "min_samples_leaf" in result:
        result["min_samples_leaf"] = _bounded_int(result, "min_samples_leaf", 1, 1, 10_000)
    if algorithm in {"logistic_regression", "support_vector_classifier"}:
        result["C"] = _bounded_float(result, "C", 1.0, 0.0, 1_000_000.0, inclusive_minimum=False)
    if "class_weight" in result and result["class_weight"] not in {None, "balanced"}:
        raise ValueError("'class_weight' currently supports only null or 'balanced'")
    if algorithm == "support_vector_classifier":
        if result.get("kernel", "rbf") not in {"linear", "rbf", "poly", "sigmoid"}:
            raise ValueError("Unsupported SVC kernel")
        gamma = result.get("gamma", "scale")
        if gamma not in {"scale", "auto"} and not isinstance(gamma, (int, float)):
            raise ValueError("'gamma' must be 'scale', 'auto', or numeric")
    if algorithm == "k_nearest_neighbors_classifier":
        result["n_neighbors"] = _bounded_int(result, "n_neighbors", 5, 1, 10_000)
        if result.get("weights", "uniform") not in {"uniform", "distance"}:
            raise ValueError("'weights' must be 'uniform' or 'distance'")
        result["p"] = _bounded_int(result, "p", 2, 1, 4)
    if (
        "max_features" in result
        and result["max_features"] not in {"sqrt", "log2", None}
        and not isinstance(result["max_features"], (int, float))
    ):
        raise ValueError("'max_features' must be 'sqrt', 'log2', null, or numeric")
    return result


def _build_estimator(definition: ModelDefinitionArtifact, seed: int) -> BaseEstimator:
    params = _validated_parameters(definition.task, definition.algorithm, definition.parameters)
    algorithm = definition.algorithm
    if algorithm == "linear_regression":
        return LinearRegression(**params)
    if algorithm == "ridge_regression":
        return Ridge(**params)
    if algorithm == "lasso_regression":
        return Lasso(**params)
    if algorithm == "elastic_net":
        return ElasticNet(random_state=seed, **params)
    if algorithm == "decision_tree_regressor":
        return DecisionTreeRegressor(random_state=seed, **params)
    if algorithm == "random_forest_regressor":
        parallel_jobs = max(1, min(os.cpu_count() or 1, ESTIMATOR_MAX_PARALLEL_JOBS))
        return RandomForestRegressor(random_state=seed, n_jobs=parallel_jobs, **params)
    if algorithm == "gradient_boosting_regressor":
        return GradientBoostingRegressor(random_state=seed, **params)
    if algorithm == "logistic_regression":
        return LogisticRegression(random_state=seed, **params)
    if algorithm == "decision_tree_classifier":
        return DecisionTreeClassifier(random_state=seed, **params)
    if algorithm == "random_forest_classifier":
        parallel_jobs = max(1, min(os.cpu_count() or 1, ESTIMATOR_MAX_PARALLEL_JOBS))
        return RandomForestClassifier(random_state=seed, n_jobs=parallel_jobs, **params)
    if algorithm == "gradient_boosting_classifier":
        return GradientBoostingClassifier(random_state=seed, **params)
    if algorithm == "support_vector_classifier":
        return SVC(probability=True, random_state=seed, **params)
    if algorithm == "k_nearest_neighbors_classifier":
        return KNeighborsClassifier(**params)
    raise ValueError(f"Unsupported algorithm: {algorithm}")


def execute_train_model(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, TrainModelConfig)
    prepared = inputs["prepared_dataset"]
    definition = inputs["model_definition"]
    assert isinstance(prepared, PreparedDatasetArtifact)
    assert isinstance(definition, ModelDefinitionArtifact)
    if prepared.task != definition.task:
        raise ValueError(
            f"Dataset task '{prepared.task}' is incompatible with model task '{definition.task}'"
        )
    seed = context.random_seed if config.random_seed is None else config.random_seed
    estimator = _build_estimator(definition, seed)
    if isinstance(estimator, KNeighborsClassifier) and estimator.n_neighbors > len(
        prepared.y_train
    ):
        raise ValueError("n_neighbors cannot exceed the number of training observations")
    context.progress(context.node_id, 0.1, f"Training {definition.algorithm}")
    dense_required = definition.algorithm in {
        "gradient_boosting_regressor",
        "gradient_boosting_classifier",
    }
    training_matrix = prepared.x_train
    test_matrix = prepared.x_test
    if dense_required and sparse.issparse(training_matrix):
        estimated_bytes = int(training_matrix.shape[0]) * int(training_matrix.shape[1]) * 8
        if estimated_bytes > 512 * 1024 * 1024:
            raise ValueError(
                "This estimator requires a dense matrix that would exceed the 512 MiB training safety budget"
            )
        training_matrix = training_matrix.toarray()
        test_matrix = test_matrix.toarray()
    estimator.fit(training_matrix, prepared.y_train)
    context.check_cancelled()
    training_metadata = {
        "random_seed": seed,
        "training_rows": len(prepared.y_train),
        "test_rows": len(prepared.y_test),
        "preprocessing": prepared.preprocessing_metadata,
        "source": prepared.source,
        "environment": context.environment,
        "target_mean": float(pd.to_numeric(prepared.y_train).mean())
        if prepared.task == "regression"
        else None,
        "training_class_counts": {
            str(label): int(count) for label, count in prepared.y_train.value_counts().items()
        }
        if prepared.task == "classification"
        else None,
        "training_majority_class": str(prepared.y_train.value_counts().index[0])
        if prepared.task == "classification"
        else None,
        "dense_model_input": dense_required,
        "estimator_parallel_jobs": getattr(estimator, "n_jobs", None),
    }
    artifact = TrainedModelArtifact(
        preprocessor=prepared.preprocessor,
        estimator=estimator,
        task=prepared.task,
        algorithm=definition.algorithm,
        parameters=_validated_parameters(
            definition.task, definition.algorithm, definition.parameters
        ),
        feature_columns=prepared.feature_columns,
        feature_schema=prepared.feature_schema,
        target_column=prepared.target_column,
        test_matrix=test_matrix,
        test_target=prepared.y_test,
        raw_test=prepared.raw_test,
        training_metadata=training_metadata,
    )
    context.progress(context.node_id, 1.0, "Model trained using the training partition")
    return NodeExecutionOutput(values={"trained_model": artifact})


METRIC_EXPLANATIONS: dict[str, dict[str, str]] = {
    "mae": {
        "measures": "The average absolute prediction error in target units.",
        "direction": "Lower is better; zero is perfect.",
        "caution": "It weights all errors linearly and can hide important subgroup errors.",
        "baseline": "Compare with the mean-prediction baseline.",
    },
    "mse": {
        "measures": "The average squared prediction error.",
        "direction": "Lower is better; zero is perfect.",
        "caution": "Large errors receive disproportionate weight and the units are squared.",
        "baseline": "Compare with the mean-prediction baseline.",
    },
    "rmse": {
        "measures": "The square root of mean squared error, in target units.",
        "direction": "Lower is better; zero is perfect.",
        "caution": "It is sensitive to large errors and outliers.",
        "baseline": "Compare with the mean-prediction baseline.",
    },
    "r_squared": {
        "measures": "The reduction in squared error relative to predicting the mean of the evaluated target values.",
        "direction": "Higher is better; negative values are possible.",
        "caution": "A high value does not establish causation, and its denominator uses the evaluated target mean.",
        "baseline": "Also compare MAE against the separately reported training-mean baseline.",
    },
    "baseline_mae": {
        "measures": "Holdout MAE from always predicting the target mean estimated on training data.",
        "direction": "Lower is better; a useful model should improve on it.",
        "caution": "A single constant baseline does not cover seasonal, grouped, or domain-specific alternatives.",
        "baseline": "This value is itself the transparent training-mean baseline.",
    },
    "accuracy": {
        "measures": "The share of holdout predictions that match the observed class.",
        "direction": "Higher is better.",
        "caution": "It can look strong when a majority class dominates.",
        "baseline": "Compare with majority-class accuracy and balanced accuracy.",
    },
    "baseline_accuracy": {
        "measures": "Holdout accuracy from always predicting the majority class identified in training data.",
        "direction": "A useful model should exceed it for the intended error costs.",
        "caution": "It can be high under imbalance and says nothing about minority-class recall.",
        "baseline": "This value is itself the transparent training-majority baseline.",
    },
    "balanced_accuracy": {
        "measures": "The average recall across classes.",
        "direction": "Higher is better.",
        "caution": "It does not reflect probability calibration or error costs.",
        "baseline": "Chance is approximately one divided by the number of classes.",
    },
    "precision_macro": {
        "measures": "Unweighted mean of per-class precision.",
        "direction": "Higher is better.",
        "caution": "It weights rare and common classes equally and ignores true negatives.",
        "baseline": "Compare per-class precision and class prevalence.",
    },
    "recall_macro": {
        "measures": "Unweighted mean of per-class recall.",
        "direction": "Higher is better.",
        "caution": "It does not encode whether false positives or false negatives cost more.",
        "baseline": "Compare per-class recall and a majority baseline.",
    },
    "f1_macro": {
        "measures": "Unweighted mean of the harmonic mean of precision and recall.",
        "direction": "Higher is better.",
        "caution": "It ignores true negatives and probability calibration.",
        "baseline": "Compare with per-class scores and a simple baseline.",
    },
    "roc_auc": {
        "measures": "For the named positive class, how often a positive example ranks above a negative example across thresholds.",
        "direction": "Higher is better; 0.5 is random ranking in binary tasks.",
        "caution": "It may look optimistic with severe class imbalance.",
        "baseline": "Compare with 0.5 and Average Precision against its prevalence baseline.",
    },
    "pr_auc": {
        "measures": "Legacy compatibility label; current runs report non-interpolated Average Precision instead.",
        "direction": "Higher is better.",
        "caution": "Do not treat Average Precision as trapezoidal area under a precision-recall curve.",
        "baseline": "Current runs report the positive-class prevalence as average_precision_baseline.",
    },
    "average_precision": {
        "measures": "Average Precision: precision at each score threshold weighted by the corresponding increase in recall.",
        "direction": "Higher is better.",
        "caution": "This non-interpolated summary depends on the named positive class and its prevalence.",
        "baseline": "Compare with average_precision_baseline, the positive-class prevalence in this holdout.",
    },
    "average_precision_baseline": {
        "measures": "The observed share of the named positive class in the holdout evaluation data.",
        "direction": "Average Precision should be interpreted relative to this prevalence, not a universal constant.",
        "caution": "Prevalence can shift between the holdout sample and the deployment population.",
        "baseline": "This value is the prevalence reference for Average Precision.",
    },
    "roc_auc_ovr_weighted": {
        "measures": "The class-support-weighted mean of one-vs-rest ROC AUC values across all classes.",
        "direction": "Higher is better; 0.5 is random ranking for each one-vs-rest comparison.",
        "caution": "Support weighting gives common classes more influence and can obscure weak rare-class ranking.",
        "baseline": "Compare with 0.5 and inspect per-class discrimination before relying on the aggregate.",
    },
    "log_loss": {
        "measures": "The penalty assigned to predicted class probabilities.",
        "direction": "Lower is better; confident wrong predictions are penalized heavily.",
        "caution": "It depends on reliable probabilities and can be dominated by a few confident errors.",
        "baseline": "Compare with probabilities based on training class frequencies.",
    },
    "baseline_log_loss": {
        "measures": "Holdout log loss from assigning every row the class frequencies estimated on training data.",
        "direction": "Lower is better; a useful probability model should improve on this training-frequency baseline.",
        "caution": "Changing class prevalence can make this baseline less representative of future data.",
        "baseline": "This value is itself the transparent training-frequency probability baseline.",
    },
}


def _complexity(estimator: BaseEstimator) -> dict[str, Any]:
    if hasattr(estimator, "coef_"):
        coefficients = np.asarray(estimator.coef_)
        return {
            "coefficient_count": int(coefficients.size),
            "largest_absolute_coefficient": float(np.max(np.abs(coefficients)))
            if coefficients.size
            else None,
        }
    if hasattr(estimator, "feature_importances_"):
        importance = np.asarray(estimator.feature_importances_)
        return {"feature_importance": [float(value) for value in importance.tolist()]}
    return {}


def execute_evaluate_model(
    config: BaseModel, inputs: dict[str, Any], context: ExecutionContext
) -> NodeExecutionOutput:
    assert isinstance(config, EvaluateModelConfig)
    trained = inputs["trained_model"]
    assert isinstance(trained, TrainedModelArtifact)
    y_true = trained.test_target
    if len(y_true) == 0:
        raise ValueError(
            "The test partition is empty; evaluation requires at least one observation"
        )
    predictions = trained.estimator.predict(trained.test_matrix)
    warnings: list[ValidationIssue] = []
    diagnostics: dict[str, Any] = {
        "holdout_rows": len(y_true),
        "evaluation_partition": "test",
        "training": trained.training_metadata,
        "model_complexity": _complexity(trained.estimator),
    }
    if len(y_true) < 30:
        warnings.append(
            _warning(
                "small_test_sample",
                "Small holdout sample",
                f"Only {len(y_true)} observations are in the test partition.",
                "Small evaluation samples yield high-variance metrics and wide uncertainty.",
                {"test_rows": len(y_true)},
                "Collect more data or use repeated cross-validation for development while preserving a final untouched test set.",
            )
        )
    if trained.task == "regression":
        training_mean = trained.training_metadata.get("target_mean")
        if training_mean is None:
            raise ValueError("The trained artifact is missing its training-only target mean")
        baseline = np.repeat(float(training_mean), len(y_true))
        mse = float(mean_squared_error(y_true, predictions))
        r2: float | None
        if len(y_true) < 2:
            r2 = None
            warnings.append(
                _warning(
                    "undefined_r_squared",
                    "R² is undefined for one holdout observation",
                    "R² was not calculated because the test partition contains fewer than two observations.",
                    "R² requires at least two evaluated outcomes to define its total-sum-of-squares denominator.",
                    {"test_rows": len(y_true), "reason": "fewer_than_two_observations"},
                    "Use a larger untouched test partition before interpreting R².",
                )
            )
        elif bool(pd.Series(y_true).nunique(dropna=False) == 1):
            r2 = None
            warnings.append(
                _warning(
                    "undefined_r_squared",
                    "R² is undefined for a constant holdout target",
                    "R² was not calculated because every observed test outcome is the same.",
                    "A constant evaluated target has zero total sum of squares, so the usual R² denominator is zero.",
                    {"test_rows": len(y_true), "reason": "constant_holdout_target"},
                    "Evaluate on a holdout sample containing target variation and retain MAE/RMSE for this sample.",
                )
            )
        else:
            r2 = float(r2_score(y_true, predictions))
        metrics: dict[str, Any] = {
            "mae": float(mean_absolute_error(y_true, predictions)),
            "mse": mse,
            "rmse": math.sqrt(mse),
            "r_squared": r2,
            "baseline_mae": float(mean_absolute_error(y_true, baseline)),
        }
        residuals = np.asarray(y_true) - np.asarray(predictions)
        diagnostics.update(
            {
                "residual_summary": {
                    "mean": float(np.mean(residuals)),
                    "standard_deviation": float(np.std(residuals, ddof=1))
                    if len(residuals) > 1
                    else None,
                },
                "predicted_vs_observed": [
                    {"observed": json_safe(observed), "predicted": json_safe(predicted)}
                    for observed, predicted in list(zip(y_true, predictions, strict=True))[:500]
                ],
            }
        )
    else:
        labels = list(trained.estimator.classes_)
        counts = y_true.value_counts()
        imbalance_ratio = (
            float(counts.max() / counts.min()) if len(counts) > 1 and counts.min() > 0 else None
        )
        if imbalance_ratio is not None and imbalance_ratio >= 4:
            warnings.append(
                _warning(
                    "severe_class_imbalance",
                    "Severe class imbalance in the holdout data",
                    f"The largest evaluated class is {imbalance_ratio:.1f} times the smallest.",
                    "Overall accuracy can be dominated by the majority class.",
                    {
                        "class_counts": {str(k): int(v) for k, v in counts.items()},
                        "imbalance_ratio": imbalance_ratio,
                    },
                    "Prioritize balanced accuracy, per-class recall, PR AUC where appropriate, and review collection or weighting choices.",
                )
            )
        precision, recall, f1, support = precision_recall_fscore_support(
            y_true, predictions, labels=labels, zero_division=0
        )
        majority_string = trained.training_metadata.get("training_majority_class")
        majority_label = next(
            (label for label in labels if str(label) == str(majority_string)), None
        )
        if majority_label is None:
            raise ValueError("The trained artifact is missing its training-only majority class")
        baseline_predictions = np.repeat(majority_label, len(y_true))
        metrics = {
            "accuracy": float(accuracy_score(y_true, predictions)),
            "baseline_accuracy": float(accuracy_score(y_true, baseline_predictions)),
            "balanced_accuracy": float(balanced_accuracy_score(y_true, predictions)),
            "precision_macro": float(
                precision_score(y_true, predictions, average="macro", zero_division=0)
            ),
            "recall_macro": float(
                recall_score(y_true, predictions, average="macro", zero_division=0)
            ),
            "f1_macro": float(f1_score(y_true, predictions, average="macro", zero_division=0)),
        }
        diagnostics.update(
            {
                "confusion_matrix": confusion_matrix(y_true, predictions, labels=labels).tolist(),
                "class_labels": [str(label) for label in labels],
                "per_class": [
                    {
                        "class": str(label),
                        "precision": float(p_value),
                        "recall": float(r_value),
                        "f1": float(f_value),
                        "support": int(s_value),
                    }
                    for label, p_value, r_value, f_value, s_value in zip(
                        labels, precision, recall, f1, support, strict=True
                    )
                ],
            }
        )
        if hasattr(trained.estimator, "predict_proba"):
            probabilities = trained.estimator.predict_proba(trained.test_matrix)
            metrics["log_loss"] = float(log_loss(y_true, probabilities, labels=labels))
            training_class_counts = trained.training_metadata.get("training_class_counts")
            if not isinstance(training_class_counts, dict):
                raise ValueError("The trained artifact is missing its training-only class counts")
            ordered_training_counts: list[float] = []
            for label in labels:
                count = training_class_counts.get(str(label))
                if not isinstance(count, int) or isinstance(count, bool) or count <= 0:
                    raise ValueError(
                        f"The trained artifact has no positive training count for class '{label}'"
                    )
                ordered_training_counts.append(float(count))
            class_frequency_row = np.asarray(ordered_training_counts, dtype=float)
            class_frequency_row /= float(class_frequency_row.sum())
            baseline_probabilities = np.tile(class_frequency_row, (len(y_true), 1))
            metrics["baseline_log_loss"] = float(
                log_loss(y_true, baseline_probabilities, labels=labels)
            )
            diagnostics["training_class_probabilities"] = {
                str(label): float(probability)
                for label, probability in zip(labels, class_frequency_row, strict=True)
            }
            if len(labels) == 2:
                positive = config.positive_class
                if positive is None:
                    positive = labels[1]
                    warnings.append(
                        _warning(
                            "implicit_positive_class",
                            "Positive class was selected by class ordering",
                            f"'{positive}' was used as the positive class because none was specified.",
                            "Binary ROC AUC and Average Precision change meaning when the positive class changes; estimator class ordering is not a research rationale.",
                            {
                                "available_classes": [str(label) for label in labels],
                                "selected_positive_class": str(positive),
                            },
                            "Set positive_class explicitly and confirm it represents the event relevant to the research question.",
                        )
                    )
                matched = next(
                    (label for label in labels if label == positive or str(label) == str(positive)),
                    None,
                )
                if matched is None:
                    raise ValueError(
                        f"Positive class '{positive}' is not one of {[str(label) for label in labels]}"
                    )
                positive_index = labels.index(matched)
                binary_true = (np.asarray(y_true) == matched).astype(int)
                scores = probabilities[:, positive_index]
                diagnostics["positive_class"] = str(matched)
                diagnostics["positive_prevalence"] = float(np.mean(binary_true))
                if len(np.unique(binary_true)) < 2:
                    warnings.append(
                        _warning(
                            "undefined_binary_ranking_metrics",
                            "Binary ranking metrics are undefined",
                            "ROC AUC and Average Precision were not calculated because the holdout lacks one binary class.",
                            "Both positive and negative evaluated observations are required for these ranking summaries.",
                            {
                                "positive_class": str(matched),
                                "holdout_positive_count": int(binary_true.sum()),
                                "holdout_rows": len(binary_true),
                            },
                            "Use a stratified holdout that contains both classes.",
                        )
                    )
                else:
                    prevalence = float(np.mean(binary_true))
                    metrics["roc_auc"] = float(roc_auc_score(binary_true, scores))
                    metrics["average_precision"] = float(
                        average_precision_score(binary_true, scores)
                    )
                    metrics["average_precision_baseline"] = prevalence
                    diagnostics["probability_metric_conventions"] = {
                        "roc_auc": "binary ranking for the named positive class",
                        "average_precision": "non_interpolated_recall_weighted_precision",
                        "average_precision_baseline": "holdout_positive_class_prevalence",
                    }
            elif len(labels) > 2:
                if config.positive_class is not None:
                    raise ValueError(
                        "positive_class applies only to binary classification; multiclass ROC AUC uses every class one-vs-rest"
                    )
                if len(counts) < len(labels):
                    warnings.append(
                        _warning(
                            "undefined_multiclass_roc_auc",
                            "Multiclass ROC AUC is undefined",
                            "Weighted one-vs-rest ROC AUC was not calculated because the holdout lacks at least one trained class.",
                            "Each class must have both positive and rest observations in the evaluation partition.",
                            {
                                "trained_classes": [str(label) for label in labels],
                                "holdout_classes": [str(label) for label in counts.index],
                            },
                            "Use a stratified holdout that preserves every trained class.",
                        )
                    )
                else:
                    metrics["roc_auc_ovr_weighted"] = float(
                        roc_auc_score(
                            y_true,
                            probabilities,
                            labels=labels,
                            multi_class="ovr",
                            average="weighted",
                        )
                    )
                    diagnostics["probability_metric_conventions"] = {
                        "roc_auc_ovr_weighted": "support_weighted_mean_of_one_vs_rest_auc"
                    }
    primary = metrics.get("r_squared") if trained.task == "regression" else metrics.get("accuracy")
    if primary is not None and primary >= 0.995:
        warnings.append(
            _warning(
                "suspiciously_high_performance",
                "Suspiciously high holdout performance",
                f"The primary holdout score is {primary:.4f}.",
                "Near-perfect performance is uncommon and can indicate leakage, duplicate records, or an unrepresentative split.",
                {
                    "score": primary,
                    "metric": "r_squared" if trained.task == "regression" else "accuracy",
                },
                "Audit feature timing, duplicates, split groups, and target-derived columns before relying on this result.",
            )
        )
    explanations = {
        name: METRIC_EXPLANATIONS[name] for name in metrics if name in METRIC_EXPLANATIONS
    }
    diagnostics["integrity_warnings"] = [warning.model_dump(mode="json") for warning in warnings]
    artifact = MetricsArtifact(
        task=trained.task,
        algorithm=trained.algorithm,
        metrics=json_safe(metrics),
        explanations=explanations,
        diagnostics=json_safe(diagnostics),
    )
    context.progress(context.node_id, 1.0, "Evaluated once on the held-out test partition")
    return NodeExecutionOutput(values={"metrics": artifact}, warnings=warnings)
