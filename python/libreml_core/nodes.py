"""Stable node contract used by the UI-independent workflow executor."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from threading import Event
from typing import Any, Protocol
from uuid import UUID

from pydantic import BaseModel

from .schemas import PortDefinition, ResourceHints, ValidationIssue

ProgressCallback = Callable[[str, float, str], None]
StructuredLogger = Callable[[str, str, dict[str, Any]], None]
type BaseModelType = type[BaseModel]


@dataclass(slots=True)
class ExecutionContext:
    project_id: UUID
    run_id: UUID
    node_id: str
    random_seed: int
    project_dir: Path
    allowed_import_roots: list[Path]
    cancellation: Event
    progress: ProgressCallback
    logger: StructuredLogger
    environment: dict[str, str]
    prior_warnings: list[ValidationIssue] = field(default_factory=list)

    def check_cancelled(self) -> None:
        if self.cancellation.is_set():
            raise ExecutionCancelled("Execution was cancelled")


class ExecutionCancelled(RuntimeError):
    pass


@dataclass(slots=True)
class NodeExecutionOutput:
    values: dict[str, Any]
    warnings: list[ValidationIssue] = field(default_factory=list)


class NodeExecutor(Protocol):
    def __call__(
        self,
        config: BaseModel,
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> NodeExecutionOutput: ...


@dataclass(frozen=True, slots=True)
class NodeDefinition:
    type: str
    version: str
    display_name: str
    category: str
    description: str
    learning_explanation: str
    research_explanation: str
    inputs: tuple[PortDefinition, ...]
    outputs: tuple[PortDefinition, ...]
    config_model: BaseModelType
    execute: NodeExecutor
    deterministic: bool = True
    cacheable: bool = True
    resource_hints: ResourceHints = field(default_factory=ResourceHints)
    documentation_ref: str | None = None

    def input(self, name: str) -> PortDefinition | None:
        return next((port for port in self.inputs if port.name == name), None)

    def output(self, name: str) -> PortDefinition | None:
        return next((port for port in self.outputs if port.name == name), None)


class NodeRegistry:
    def __init__(self) -> None:
        self._definitions: dict[str, NodeDefinition] = {}

    def register(self, definition: NodeDefinition) -> None:
        if definition.type in self._definitions:
            raise ValueError(f"Node type is already registered: {definition.type}")
        self._definitions[definition.type] = definition

    def get(self, node_type: str) -> NodeDefinition | None:
        return self._definitions.get(node_type)

    def require(self, node_type: str) -> NodeDefinition:
        definition = self.get(node_type)
        if definition is None:
            raise KeyError(f"Unknown node type: {node_type}")
        return definition

    def all(self) -> list[NodeDefinition]:
        return sorted(self._definitions.values(), key=lambda definition: definition.type)
