"""Versioned schemas shared by persistence, execution, and the HTTP boundary."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SCHEMA_VERSION = "1.0"


def utc_now() -> datetime:
    return datetime.now(UTC)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class ProjectMode(StrEnum):
    LEARNING = "learning"
    RESEARCH = "research"


class PortType(StrEnum):
    DATASET = "Dataset"
    OVERVIEW = "DatasetOverview"
    LABELED_DATASET = "LabeledDataset"
    SPLIT_DATASET = "SplitDataset"
    PREPARED_DATASET = "PreparedDataset"
    MODEL_DEFINITION = "ModelDefinition"
    TRAINED_MODEL = "TrainedModel"
    METRICS = "Metrics"
    REPORT_ARTIFACT = "ReportArtifact"


class NodeStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    WARNING = "warning"
    FAILED = "failed"
    CANCELLED = "cancelled"
    CACHED = "cached"
    STALE = "stale"


class RunStatus(StrEnum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    BLOCKED = "blocked"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Severity(StrEnum):
    INFORMATION = "information"
    CAUTION = "caution"
    WARNING = "warning"
    BLOCKING = "blocking_error"


class PortDefinition(StrictModel):
    name: str = Field(min_length=1, max_length=80)
    type: PortType
    required: bool = True
    multiple: bool = False
    description: str = ""


class ResourceHints(StrictModel):
    cpu: Literal["low", "medium", "high"] = "low"
    memory: Literal["low", "medium", "high"] = "low"
    streams_progress: bool = False


class NodeSpecView(StrictModel):
    type: str
    version: str
    display_name: str
    category: str
    description: str
    learning_explanation: str
    research_explanation: str
    inputs: list[PortDefinition]
    outputs: list[PortDefinition]
    default_config: dict[str, Any]
    config_schema: dict[str, Any]
    deterministic: bool
    cacheable: bool
    resource_hints: ResourceHints = Field(default_factory=ResourceHints)
    documentation_ref: str | None = None


class CanvasPosition(StrictModel):
    x: float
    y: float


class WorkflowNode(StrictModel):
    id: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9_.:-]+$")
    type: str = Field(min_length=1, max_length=120)
    version: str = "1.0.0"
    config: dict[str, Any] = Field(default_factory=dict)
    position: CanvasPosition | None = None
    label: str | None = Field(default=None, max_length=160)


class WorkflowEdge(StrictModel):
    id: str = Field(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9_.:-]+$")
    source_node: str
    source_port: str
    target_node: str
    target_port: str

    @model_validator(mode="after")
    def no_self_loop(self) -> WorkflowEdge:
        if self.source_node == self.target_node:
            raise ValueError("A node cannot connect to itself")
        return self


class WorkflowGraph(StrictModel):
    schema_version: str = SCHEMA_VERSION
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)

    @field_validator("schema_version")
    @classmethod
    def supported_schema(cls, value: str) -> str:
        if value != SCHEMA_VERSION:
            raise ValueError(f"Unsupported workflow schema version: {value}")
        return value

    @model_validator(mode="after")
    def unique_ids(self) -> WorkflowGraph:
        node_ids = [node.id for node in self.nodes]
        edge_ids = [edge.id for edge in self.edges]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Workflow node IDs must be unique")
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("Workflow edge IDs must be unique")
        return self


class ValidationIssue(StrictModel):
    code: str
    severity: Severity
    title: str
    plain_explanation: str
    technical_explanation: str
    evidence: dict[str, Any] = Field(default_factory=dict)
    likely_consequence: str
    recommended_repair: str
    automatic_repair_available: bool = False
    node_ids: list[str] = Field(default_factory=list)
    repair_patch: dict[str, Any] | None = None


class ValidationResult(StrictModel):
    valid: bool
    execution_order: list[str] = Field(default_factory=list)
    issues: list[ValidationIssue] = Field(default_factory=list)


class ArtifactSummary(StrictModel):
    node_id: str
    port: str
    type: PortType
    fingerprint: str
    preview: Any = None


class NodeRunResult(StrictModel):
    node_id: str
    status: NodeStatus
    duration_ms: float
    cache_key: str | None = None
    error: str | None = None
    output_ports: list[str] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)
    cache_hit: bool = False


class RunRequest(StrictModel):
    run_id: UUID | None = None
    workflow: WorkflowGraph | None = None
    target_node_ids: list[str] | None = None
    random_seed: int = Field(default=42, ge=0, le=2**32 - 1)


class RunResult(StrictModel):
    run_id: UUID = Field(default_factory=uuid4)
    status: RunStatus
    node_results: list[NodeRunResult]
    artifacts: list[ArtifactSummary]
    warnings: list[ValidationIssue] = Field(default_factory=list)
    started_at: datetime
    finished_at: datetime
    workflow_hash: str | None = None
    project_revision: int | None = None
    workflow_source: Literal["saved", "ad_hoc"] = "saved"


class ProjectCreate(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    research_question: str | None = Field(default=None, max_length=4000)
    mode: ProjectMode = ProjectMode.LEARNING


class ProjectRecord(ProjectCreate):
    id: UUID = Field(default_factory=uuid4)
    schema_version: str = SCHEMA_VERSION
    workflow: WorkflowGraph = Field(default_factory=WorkflowGraph)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    revision: int = 1


class WorkflowSaveResult(StrictModel):
    project: ProjectRecord
    validation: ValidationResult
    stale_node_ids: list[str]


class PredictionRequest(StrictModel):
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=10_000)


class PredictionResponse(StrictModel):
    predictions: list[Any]
    probabilities: list[dict[str, float]] | None = None
    classes: list[str] | None = None
    warning: str = "Predictions describe patterns learned from the supplied data; they are not evidence of causation."


class AuditEventView(StrictModel):
    sequence: int
    event_type: str
    occurred_at: datetime
    narrative: str
    payload: dict[str, Any]
    previous_hash: str
    event_hash: str


class IntegrityCheck(StrictModel):
    valid: bool
    checked_events: int
    first_invalid_sequence: int | None = None


class ImportResponse(StrictModel):
    relative_path: str
    size_bytes: int
    sha256: str
    suggested_node_config: dict[str, Any]


class RepairDecision(StrictModel):
    warning_code: str = Field(min_length=1, max_length=120)
    node_id: str = Field(min_length=1, max_length=120)
    decision: Literal["approve", "reject"]
    repair_patch: dict[str, Any] | None = None
