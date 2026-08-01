"""Local-file safeguards shared by uploads and data-source nodes."""

from __future__ import annotations

import hashlib
import re
import zipfile
from pathlib import Path

DEFAULT_MAX_IMPORT_BYTES = 100 * 1024 * 1024
MAX_EXCEL_UNCOMPRESSED_BYTES = 512 * 1024 * 1024
MAX_EXCEL_COMPRESSION_RATIO = 200
SAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")


class ImportSecurityError(ValueError):
    """Raised when an import violates an explicit local security boundary."""


def sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    sanitized = SAFE_FILENAME.sub("_", name).strip("._")
    if not sanitized:
        raise ImportSecurityError("The supplied filename is not usable")
    return sanitized[:180]


def resolve_allowed_path(path: str | Path, allowed_roots: list[Path]) -> Path:
    candidate = Path(path).expanduser().resolve(strict=True)
    resolved_roots = [root.expanduser().resolve(strict=True) for root in allowed_roots]
    if not any(candidate.is_relative_to(root) for root in resolved_roots):
        raise ImportSecurityError("The data path is outside the project's allowed import roots")
    if not candidate.is_file():
        raise ImportSecurityError("The data path is not a regular file")
    return candidate


def enforce_file_size(path: Path, max_bytes: int = DEFAULT_MAX_IMPORT_BYTES) -> int:
    size = path.stat().st_size
    if size <= 0:
        raise ImportSecurityError("The imported file is empty")
    if size > max_bytes:
        raise ImportSecurityError(
            f"The imported file is {size} bytes; the configured limit is {max_bytes} bytes"
        )
    return size


def inspect_excel_archive(path: Path) -> None:
    """Reject suspicious OOXML archives before openpyxl decompresses them."""
    if path.suffix.lower() not in {".xlsx", ".xlsm"}:
        return
    try:
        with zipfile.ZipFile(path) as archive:
            total_compressed = 0
            total_uncompressed = 0
            for member in archive.infolist():
                member_path = Path(member.filename)
                if member_path.is_absolute() or ".." in member_path.parts:
                    raise ImportSecurityError("The spreadsheet archive contains an unsafe path")
                total_compressed += member.compress_size
                total_uncompressed += member.file_size
                if total_uncompressed > MAX_EXCEL_UNCOMPRESSED_BYTES:
                    raise ImportSecurityError(
                        "The spreadsheet expands beyond the safe memory limit"
                    )
            ratio = total_uncompressed / max(total_compressed, 1)
            if ratio > MAX_EXCEL_COMPRESSION_RATIO:
                raise ImportSecurityError("The spreadsheet has a suspicious compression ratio")
    except zipfile.BadZipFile as exc:
        raise ImportSecurityError("The spreadsheet is not a valid OOXML archive") from exc


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()
