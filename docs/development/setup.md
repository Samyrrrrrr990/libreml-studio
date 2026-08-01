# Development setup

## Prerequisites

- Python 3.12
- [`uv`](https://docs.astral.sh/uv/)
- Node.js 20+ and npm 10+
- Git

The application is developed as two loopback processes: a Python API/executor and a React/Vite workbench. No paid service, account, or hosted model is required.

## Install

From the repository root:

```bash
uv sync --all-extras --locked
npm ci
```

Do not use `sudo` and do not commit `.venv`, `node_modules`, local project files, datasets, credentials, or generated participant reports.

## Run locally

Start the registered local backend and the web workbench in separate terminals:

```bash
uv run libreml-backend
npm run dev
```

For backend reload during development, the equivalent direct ASGI command is expected to be:

```bash
uv run uvicorn libreml_api.main:app --host 127.0.0.1 --port 8000 --reload
```

Never replace `127.0.0.1` with `0.0.0.0` for convenience. LAN/public binding changes the threat model and is unsupported in the Research Preview. Vite prints its local URL; the API health route should be available on the configured loopback port.

## Quality checks

```bash
uv run ruff check .
uv run mypy python apps/backend
uv run pytest

npm run lint
npm run typecheck
npm run test
npm run build
```

CI is authoritative for supported versions. Tests must use temporary project roots and synthetic fixtures, must not make network requests, and must set seeds explicitly. `make check` runs the complete local lint, test, and build gate.

## Environment configuration

Committed defaults are safe and local. Copy `.env.example` to `.env` only when you need an override. Vite loads that root file for the development UI; export backend variables in the backend shell or load the file with your process manager. `LIBREML_PORT` selects the loopback API port, `LIBREML_DATA_DIR` selects the local project-data directory, `LIBREML_API_URL` points the Vite development proxy at that loopback service, and `VITE_API_BASE_URL` overrides the browser-facing API base. Do not invent undocumented production flags.

Credentials are not ordinary environment configuration. Use a local `.env` only for disposable development values, keep it ignored, and never print it. Production connectors should reference an OS-backed secret store.

## Local data

Use bundled synthetic fixtures or create de-identified data. Keep manually created projects outside the repository or under an ignored development directory. A test fixture must state its provenance/license and must be small enough for code review.

## Troubleshooting

- **UI cannot reach API:** confirm both processes, loopback port, and configured API base URL; do not “fix” this with permissive CORS.
- **Port in use:** choose another loopback port through documented settings.
- **Import failure:** inspect the safe structured error and file type/size; do not paste sensitive rows into an issue.
- **Python package not found:** run through `uv run` from the repository root so workspace paths are configured.
- **Stale UI dependencies:** use the lockfile-backed install command; do not delete unrelated lockfiles casually.

## Production build

```bash
npm run build
uv run pytest
```

A successful build is not a desktop release. Signing, updater behavior, SBOM/provenance, packaged-license notices, cross-platform golden paths, and security gates in [acceptance criteria](../product/acceptance-criteria.md) are separately required.
