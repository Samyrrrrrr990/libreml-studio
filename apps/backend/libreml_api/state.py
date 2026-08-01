"""Application state, deliberately scoped per project for artifact isolation."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from threading import Event, Lock, RLock
from uuid import UUID

from libreml_core.artifacts import ArtifactStore
from libreml_core.execution import WorkflowExecutor
from libreml_core.nodes import NodeRegistry
from libreml_core.persistence import ProjectRepository
from libreml_core.schemas import RunResult, ValidationIssue
from libreml_nodes import build_registry


@dataclass(slots=True)
class ProjectRuntime:
    executor: WorkflowExecutor
    runs: dict[UUID, RunResult] = field(default_factory=dict)
    cancellations: dict[UUID, Event] = field(default_factory=dict)
    pending_warnings: dict[tuple[str, str], list[ValidationIssue]] = field(default_factory=dict)
    lock: RLock = field(default_factory=RLock)
    execution_lock: Lock = field(default_factory=Lock)


class AppState:
    def __init__(self, data_root: Path, bundled_data_root: Path | None = None) -> None:
        self.data_root = data_root.resolve()
        self.data_root.mkdir(parents=True, exist_ok=True)
        self.bundled_data_root = (
            bundled_data_root or Path(__file__).resolve().parent / "resources" / "datasets"
        ).resolve()
        self.registry: NodeRegistry = build_registry()
        self.repository = ProjectRepository(self.data_root / "metadata.sqlite3")
        self._runtimes: dict[UUID, ProjectRuntime] = {}
        self._lock = RLock()

    def project_dir(self, project_id: UUID) -> Path:
        directory = (self.data_root / "projects" / str(project_id)).resolve()
        if not directory.is_relative_to(self.data_root):
            raise ValueError("Invalid project path")
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    def runtime(self, project_id: UUID) -> ProjectRuntime:
        with self._lock:
            runtime = self._runtimes.get(project_id)
            if runtime is None:
                runtime = ProjectRuntime(executor=WorkflowExecutor(self.registry, ArtifactStore()))
                self._runtimes[project_id] = runtime
            return runtime


def default_data_root() -> Path:
    configured = os.environ.get("LIBREML_DATA_DIR")
    if configured:
        return Path(configured).expanduser()
    return Path.home() / ".libreml"
