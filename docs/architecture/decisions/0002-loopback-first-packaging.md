# ADR-0002: Loopback web application before desktop wrapper

- Status: accepted for Research Preview; desktop choice deferred
- Date: 2026-07-31

## Context

Tauri offers a small system-webview wrapper; Electron offers a uniform runtime and mature ecosystem at greater footprint. Packaging adds updater, signing, process lifecycle, port/token, webview, and cross-platform risk before the workflow is stable.

## Decision

Develop the Research Preview as a React UI plus FastAPI service bound to loopback. Harden Host/Origin/session controls now. Re-evaluate Tauri as the preferred production wrapper after the vertical slice and security gates; compare Electron with measured compatibility and memory data.

## Consequences

Development remains inspectable and fast, but users manage two processes until packaging. Loopback is a real security boundary, not an excuse for permissive CORS or public binding. A browser-local preview is not marketed as the final installer.
