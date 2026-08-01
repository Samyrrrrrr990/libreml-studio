.PHONY: install backend web lint test build check

install:
	uv sync --all-extras --locked
	npm ci

backend:
	uv run libreml-backend

web:
	npm run dev

lint:
	uv run ruff check .
	uv run mypy
	npm run lint
	npm run typecheck

test:
	uv run pytest
	npm run test

build:
	npm run build
	uv build

check: lint test build
