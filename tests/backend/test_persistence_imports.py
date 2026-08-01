from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd
from libreml_core.persistence import ProjectRepository
from libreml_core.schemas import ProjectCreate


def test_audit_hash_chain_detects_tampering(tmp_path: Path) -> None:
    repository = ProjectRepository(tmp_path / "metadata.sqlite3")
    project = repository.create(ProjectCreate(title="Integrity test"))
    repository.append_audit(project.id, "test_event", "Recorded a decision.", {"decision": "keep"})
    assert repository.verify_audit(project.id).valid
    with sqlite3.connect(repository.database_path) as connection:
        connection.execute(
            "UPDATE audit_events SET narrative = 'tampered' WHERE project_id = ? AND sequence = 2",
            (str(project.id),),
        )
        connection.commit()
    result = repository.verify_audit(project.id)
    assert not result.valid
    assert result.first_invalid_sequence == 2


def test_excel_and_parquet_dependencies_roundtrip_locally(tmp_path: Path) -> None:
    frame = pd.DataFrame({"feature": [1, 2], "category": ["a", "b"]})
    excel = tmp_path / "safe.xlsx"
    parquet = tmp_path / "safe.parquet"
    frame.to_excel(excel, index=False)
    frame.to_parquet(parquet, index=False)
    assert pd.read_excel(excel).equals(frame)
    assert pd.read_parquet(parquet).equals(frame)
