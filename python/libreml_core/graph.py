"""Typed DAG validation, topology, dependency lineage, and stale detection."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict, deque
from typing import Any

from pydantic import ValidationError

from .nodes import NodeRegistry
from .schemas import Severity, ValidationIssue, ValidationResult, WorkflowGraph


def _issue(
    code: str,
    title: str,
    explanation: str,
    *,
    node_ids: list[str] | None = None,
    evidence: dict[str, Any] | None = None,
) -> ValidationIssue:
    return ValidationIssue(
        code=code,
        severity=Severity.BLOCKING,
        title=title,
        plain_explanation=explanation,
        technical_explanation=explanation,
        evidence=evidence or {},
        likely_consequence="The workflow cannot run reproducibly until this is corrected.",
        recommended_repair="Correct the highlighted workflow connection or configuration.",
        node_ids=node_ids or [],
    )


def _safe_config_errors(exc: ValidationError) -> list[dict[str, Any]]:
    """Return useful Pydantic diagnostics without reflecting submitted values.

    Pydantic includes the rejected input in its default string and ``errors()``
    representations. Node configuration is user-controlled and may contain a
    password, token, or other sensitive value, so validation findings retain only
    the stable field location and error type.
    """
    return [
        {
            "location": [str(part) for part in error.get("loc", ())],
            "type": str(error.get("type", "validation_error")),
        }
        for error in exc.errors(include_url=False, include_context=False, include_input=False)
    ]


class GraphValidator:
    def __init__(self, registry: NodeRegistry) -> None:
        self.registry = registry

    def validate(self, graph: WorkflowGraph) -> ValidationResult:
        issues: list[ValidationIssue] = []
        nodes = {node.id: node for node in graph.nodes}
        incoming: dict[tuple[str, str], list[str]] = defaultdict(list)
        adjacency: dict[str, set[str]] = {node_id: set() for node_id in nodes}
        indegree = {node_id: 0 for node_id in nodes}

        for node in graph.nodes:
            definition = self.registry.get(node.type)
            if definition is None:
                issues.append(
                    _issue(
                        "unknown_node_type",
                        "Unknown node type",
                        f"Node '{node.id}' uses unregistered type '{node.type}'.",
                        node_ids=[node.id],
                    )
                )
                continue
            if node.version != definition.version:
                issues.append(
                    _issue(
                        "unsupported_node_version",
                        "Unsupported node version",
                        f"Node '{node.id}' requests {node.version}, but this runtime provides {definition.version}.",
                        node_ids=[node.id],
                    )
                )
            try:
                definition.config_model.model_validate(node.config)
            except ValidationError as exc:
                issues.append(
                    _issue(
                        "invalid_node_config",
                        "Invalid node configuration",
                        f"Node '{node.id}' has one or more invalid settings. Review the highlighted fields.",
                        node_ids=[node.id],
                        evidence={"validation_errors": _safe_config_errors(exc)},
                    )
                )

        seen_connections: set[tuple[str, str, str, str]] = set()
        for edge in graph.edges:
            if edge.source_node not in nodes or edge.target_node not in nodes:
                issues.append(
                    _issue(
                        "dangling_edge",
                        "Connection references a missing node",
                        f"Connection '{edge.id}' references a node that is not present.",
                        node_ids=[edge.source_node, edge.target_node],
                    )
                )
                continue
            connection = (edge.source_node, edge.source_port, edge.target_node, edge.target_port)
            if connection in seen_connections:
                issues.append(
                    _issue(
                        "duplicate_edge",
                        "Duplicate connection",
                        f"Connection '{edge.id}' duplicates an existing connection.",
                        node_ids=[edge.source_node, edge.target_node],
                    )
                )
                continue
            seen_connections.add(connection)
            source_def = self.registry.get(nodes[edge.source_node].type)
            target_def = self.registry.get(nodes[edge.target_node].type)
            if source_def is None or target_def is None:
                continue
            source_port = source_def.output(edge.source_port)
            target_port = target_def.input(edge.target_port)
            if source_port is None:
                issues.append(
                    _issue(
                        "unknown_output_port",
                        "Unknown output port",
                        f"'{edge.source_port}' is not an output of '{edge.source_node}'.",
                        node_ids=[edge.source_node],
                    )
                )
                continue
            if target_port is None:
                issues.append(
                    _issue(
                        "unknown_input_port",
                        "Unknown input port",
                        f"'{edge.target_port}' is not an input of '{edge.target_node}'.",
                        node_ids=[edge.target_node],
                    )
                )
                continue
            if source_port.type != target_port.type:
                issues.append(
                    _issue(
                        "incompatible_port_types",
                        "Incompatible connection",
                        f"{source_port.type.value} cannot connect to {target_port.type.value}.",
                        node_ids=[edge.source_node, edge.target_node],
                        evidence={
                            "source_type": source_port.type.value,
                            "target_type": target_port.type.value,
                        },
                    )
                )
                continue
            incoming[(edge.target_node, edge.target_port)].append(edge.id)
            if edge.target_node not in adjacency[edge.source_node]:
                adjacency[edge.source_node].add(edge.target_node)
                indegree[edge.target_node] += 1

        for node in graph.nodes:
            definition = self.registry.get(node.type)
            if definition is None:
                continue
            for port in definition.inputs:
                connections = incoming.get((node.id, port.name), [])
                if port.required and not connections:
                    issues.append(
                        _issue(
                            "missing_required_input",
                            "Required input is not connected",
                            f"Node '{node.id}' needs a connection at '{port.name}'.",
                            node_ids=[node.id],
                        )
                    )
                if not port.multiple and len(connections) > 1:
                    issues.append(
                        _issue(
                            "multiple_single_input",
                            "Too many input connections",
                            f"Input '{port.name}' on '{node.id}' accepts one connection.",
                            node_ids=[node.id],
                        )
                    )

        queue = deque(sorted(node_id for node_id, degree in indegree.items() if degree == 0))
        order: list[str] = []
        while queue:
            node_id = queue.popleft()
            order.append(node_id)
            for downstream in sorted(adjacency[node_id]):
                indegree[downstream] -= 1
                if indegree[downstream] == 0:
                    queue.append(downstream)
        if len(order) != len(nodes):
            cyclic = sorted(node_id for node_id, degree in indegree.items() if degree > 0)
            issues.append(
                _issue(
                    "cycle_detected",
                    "Workflow contains a cycle",
                    "LibreML workflows are directed acyclic graphs; remove at least one connection in the cycle.",
                    node_ids=cyclic,
                    evidence={"cycle_nodes": cyclic},
                )
            )
            order = []
        return ValidationResult(
            valid=not any(issue.severity == Severity.BLOCKING for issue in issues),
            execution_order=order,
            issues=issues,
        )


def upstream_closure(graph: WorkflowGraph, targets: set[str]) -> set[str]:
    parents: dict[str, set[str]] = defaultdict(set)
    for edge in graph.edges:
        parents[edge.target_node].add(edge.source_node)
    closure = set(targets)
    stack = list(targets)
    while stack:
        child = stack.pop()
        for parent in parents[child]:
            if parent not in closure:
                closure.add(parent)
                stack.append(parent)
    return closure


def descendants(graph: WorkflowGraph, roots: set[str]) -> set[str]:
    children: dict[str, set[str]] = defaultdict(set)
    for edge in graph.edges:
        children[edge.source_node].add(edge.target_node)
    found: set[str] = set()
    stack = list(roots)
    while stack:
        node_id = stack.pop()
        for child in children[node_id]:
            if child not in found:
                found.add(child)
                stack.append(child)
    return found


def lineage_hashes(graph: WorkflowGraph) -> dict[str, str]:
    """Hash node definitions plus ordered incoming lineages, independent of canvas layout."""
    by_id = {node.id: node for node in graph.nodes}
    parents: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    indegree = {node.id: 0 for node in graph.nodes}
    children: dict[str, set[str]] = defaultdict(set)
    for edge in graph.edges:
        if edge.source_node in by_id and edge.target_node in by_id:
            parents[edge.target_node].append((edge.target_port, edge.source_port, edge.source_node))
            if edge.target_node not in children[edge.source_node]:
                children[edge.source_node].add(edge.target_node)
                indegree[edge.target_node] += 1
    queue = deque(sorted(node_id for node_id, degree in indegree.items() if degree == 0))
    result: dict[str, str] = {}
    while queue:
        node_id = queue.popleft()
        node = by_id[node_id]
        payload = {
            "type": node.type,
            "version": node.version,
            "config": node.config,
            "inputs": [
                {"target_port": target_port, "source_port": source_port, "lineage": result[source]}
                for target_port, source_port, source in sorted(parents[node_id])
            ],
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
        result[node_id] = hashlib.sha256(encoded.encode()).hexdigest()
        for child in sorted(children[node_id]):
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)
    return result


def stale_after_change(previous: WorkflowGraph, current: WorkflowGraph) -> set[str]:
    previous_hashes = lineage_hashes(previous)
    current_hashes = lineage_hashes(current)
    removed = set(previous_hashes) - set(current_hashes)
    changed = {
        node_id
        for node_id, current_hash in current_hashes.items()
        if previous_hashes.get(node_id) != current_hash
    }
    return removed | changed


def workflow_fingerprint(graph: WorkflowGraph) -> str:
    payload = graph.model_dump(mode="json", exclude={"nodes": {"__all__": {"position", "label"}}})
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()
