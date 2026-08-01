"""SQLite project metadata and tamper-evident, append-only audit events."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Any
from uuid import UUID

from .schemas import AuditEventView, IntegrityCheck, ProjectCreate, ProjectRecord, WorkflowGraph

GENESIS_HASH = "0" * 64


class ProjectNotFoundError(KeyError):
    pass


class RevisionConflictError(RuntimeError):
    pass


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


class ProjectRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._initialize()

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self._connection() as connection:
            current_mode = str(connection.execute("PRAGMA journal_mode").fetchone()[0]).lower()
            if current_mode != "wal":
                try:
                    connection.execute("PRAGMA journal_mode = WAL")
                except sqlite3.OperationalError as exc:
                    if "locked" not in str(exc).lower():
                        raise
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    schema_version TEXT NOT NULL,
                    title TEXT NOT NULL,
                    research_question TEXT,
                    mode TEXT NOT NULL,
                    workflow_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    revision INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS audit_events (
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    sequence INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    occurred_at TEXT NOT NULL,
                    narrative TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    previous_hash TEXT NOT NULL,
                    event_hash TEXT NOT NULL,
                    PRIMARY KEY (project_id, sequence)
                );
                CREATE INDEX IF NOT EXISTS audit_project_sequence ON audit_events(project_id, sequence);
                """
            )

    def create(self, request: ProjectCreate) -> ProjectRecord:
        project = ProjectRecord(**request.model_dump())
        with self._lock, self._connection() as connection:
            connection.execute(
                "INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    str(project.id),
                    project.schema_version,
                    project.title,
                    project.research_question,
                    project.mode.value,
                    project.workflow.model_dump_json(),
                    project.created_at.isoformat(),
                    project.updated_at.isoformat(),
                    project.revision,
                ),
            )
            self._append_with_connection(
                connection,
                project.id,
                "project_created",
                f"Created project '{project.title}'.",
                {"mode": project.mode.value, "schema_version": project.schema_version},
            )
        return project

    def get(self, project_id: UUID) -> ProjectRecord:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM projects WHERE id = ?", (str(project_id),)
            ).fetchone()
        if row is None:
            raise ProjectNotFoundError(str(project_id))
        return self._row_to_project(row)

    def list_projects(self) -> list[ProjectRecord]:
        with self._connection() as connection:
            rows = connection.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
        return [self._row_to_project(row) for row in rows]

    def save_workflow(
        self, project_id: UUID, workflow: WorkflowGraph, expected_revision: int | None = None
    ) -> ProjectRecord:
        now = datetime.now(UTC)
        with self._lock, self._connection() as connection:
            current = connection.execute(
                "SELECT revision FROM projects WHERE id = ?", (str(project_id),)
            ).fetchone()
            if current is None:
                raise ProjectNotFoundError(str(project_id))
            if expected_revision is not None and current["revision"] != expected_revision:
                raise RevisionConflictError(
                    f"Expected revision {expected_revision}, found {current['revision']}"
                )
            revision = int(current["revision"]) + 1
            connection.execute(
                "UPDATE projects SET workflow_json = ?, updated_at = ?, revision = ? WHERE id = ?",
                (workflow.model_dump_json(), now.isoformat(), revision, str(project_id)),
            )
            self._append_with_connection(
                connection,
                project_id,
                "workflow_saved",
                f"Saved workflow revision {revision}.",
                {
                    "revision": revision,
                    "node_count": len(workflow.nodes),
                    "edge_count": len(workflow.edges),
                },
            )
        return self.get(project_id)

    def append_audit(
        self, project_id: UUID, event_type: str, narrative: str, payload: dict[str, Any]
    ) -> AuditEventView:
        with self._lock, self._connection() as connection:
            exists = connection.execute(
                "SELECT 1 FROM projects WHERE id = ?", (str(project_id),)
            ).fetchone()
            if exists is None:
                raise ProjectNotFoundError(str(project_id))
            return self._append_with_connection(
                connection, project_id, event_type, narrative, payload
            )

    def _append_with_connection(
        self,
        connection: sqlite3.Connection,
        project_id: UUID,
        event_type: str,
        narrative: str,
        payload: dict[str, Any],
    ) -> AuditEventView:
        previous = connection.execute(
            "SELECT sequence, event_hash FROM audit_events WHERE project_id = ? ORDER BY sequence DESC LIMIT 1",
            (str(project_id),),
        ).fetchone()
        sequence = int(previous["sequence"]) + 1 if previous else 1
        previous_hash = str(previous["event_hash"]) if previous else GENESIS_HASH
        occurred_at = datetime.now(UTC)
        body = {
            "project_id": str(project_id),
            "sequence": sequence,
            "event_type": event_type,
            "occurred_at": occurred_at.isoformat(),
            "narrative": narrative,
            "payload": payload,
            "previous_hash": previous_hash,
        }
        event_hash = hashlib.sha256(_canonical(body).encode()).hexdigest()
        connection.execute(
            "INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                str(project_id),
                sequence,
                event_type,
                occurred_at.isoformat(),
                narrative,
                _canonical(payload),
                previous_hash,
                event_hash,
            ),
        )
        return AuditEventView(
            sequence=sequence,
            event_type=event_type,
            occurred_at=occurred_at,
            narrative=narrative,
            payload=payload,
            previous_hash=previous_hash,
            event_hash=event_hash,
        )

    def audit_events(self, project_id: UUID) -> list[AuditEventView]:
        self.get(project_id)
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT * FROM audit_events WHERE project_id = ? ORDER BY sequence",
                (str(project_id),),
            ).fetchall()
        return [
            AuditEventView(
                sequence=row["sequence"],
                event_type=row["event_type"],
                occurred_at=row["occurred_at"],
                narrative=row["narrative"],
                payload=json.loads(row["payload_json"]),
                previous_hash=row["previous_hash"],
                event_hash=row["event_hash"],
            )
            for row in rows
        ]

    def verify_audit(self, project_id: UUID) -> IntegrityCheck:
        events = self.audit_events(project_id)
        previous_hash = GENESIS_HASH
        for event in events:
            body = {
                "project_id": str(project_id),
                "sequence": event.sequence,
                "event_type": event.event_type,
                "occurred_at": event.occurred_at.isoformat(),
                "narrative": event.narrative,
                "payload": event.payload,
                "previous_hash": event.previous_hash,
            }
            expected = hashlib.sha256(_canonical(body).encode()).hexdigest()
            if event.previous_hash != previous_hash or event.event_hash != expected:
                return IntegrityCheck(
                    valid=False,
                    checked_events=event.sequence - 1,
                    first_invalid_sequence=event.sequence,
                )
            previous_hash = event.event_hash
        return IntegrityCheck(valid=True, checked_events=len(events))

    @staticmethod
    def _row_to_project(row: sqlite3.Row) -> ProjectRecord:
        return ProjectRecord(
            id=row["id"],
            schema_version=row["schema_version"],
            title=row["title"],
            research_question=row["research_question"],
            mode=row["mode"],
            workflow=WorkflowGraph.model_validate_json(row["workflow_json"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            revision=row["revision"],
        )
