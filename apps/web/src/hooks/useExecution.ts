import { useCallback, useEffect, useRef } from 'react';

import { SAMPLE_RESULTS } from '../data/sample';
import {
  ApiError,
  libreMlApi,
  type BackendRunResult,
  type BackendValidationIssue,
} from '../lib/api';
import { toApiGraph } from '../lib/graph';
import { useWorkspaceStore } from '../store/workspace';
import type { EvaluationResults, IntegrityWarning, MetricDatum, WorkflowNode } from '../types/workflow';

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const topologicalOrder = (nodes: WorkflowNode[]): WorkflowNode[] =>
  [...nodes].sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const metricFromValue = (label: string, value: number, details: unknown): MetricDatum => {
  const detail = isRecord(details) ? details : {};
  const measures = typeof detail.measures === 'string'
    ? detail.measures
    : 'Reported by the local execution engine for the held-out evaluation partition.';
  const baseline = typeof detail.baseline === 'string' ? ` ${detail.baseline}` : '';
  const direction = typeof detail.direction === 'string' ? detail.direction : '';
  return {
    label,
    value,
    displayValue: Number.isFinite(value) ? value.toFixed(3) : String(value),
    direction: /lower/i.test(direction) || /loss|error|rmse|mae|mse/i.test(label) ? 'lower' : 'higher',
    explanation: `${measures}${baseline}`,
    caution: typeof detail.caution === 'string'
      ? detail.caution
      : 'Interpret this value alongside its baseline, split design, and subgroup diagnostics.',
  };
};

const parseBackendResults = (response: BackendRunResult, nodes: WorkflowNode[]): EvaluationResults | null => {
  const metricsArtifact = response.artifacts.find((artifact) => artifact.port === 'metrics');
  if (!metricsArtifact || !isRecord(metricsArtifact.preview)) return null;
  const preview = metricsArtifact.preview;
  if (!isRecord(preview.metrics)) return null;
  const metrics = Object.fromEntries(
    Object.entries(preview.metrics).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
  if (Object.keys(metrics).length === 0) return null;
  const explanations = isRecord(preview.explanations) ? preview.explanations : {};
  const diagnostics = isRecord(preview.diagnostics) ? preview.diagnostics : {};
  const roles = nodes.find((node) => node.data.nodeType === 'assign_roles');
  const model = nodes.find((node) => node.data.nodeType === 'model_definition');
  const split = nodes.find((node) => node.data.nodeType === 'train_test_split');
  const task = typeof preview.task === 'string'
    ? preview.task
    : String(roles?.data.config.task ?? model?.data.config.task ?? 'regression');
  const algorithmName = typeof preview.algorithm === 'string'
    ? preview.algorithm
    : String(model?.data.config.algorithm ?? 'trained_model');
  const algorithm = algorithmName
    .split('_')
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
  const classLabels = Array.isArray(diagnostics.class_labels) ? diagnostics.class_labels : [];
  const residuals = Array.isArray(diagnostics.predicted_vs_observed)
    ? diagnostics.predicted_vs_observed.flatMap((point) => {
        if (!isRecord(point) || typeof point.predicted !== 'number' || typeof point.observed !== 'number') return [];
        return [{ predicted: point.predicted, residual: point.observed - point.predicted }];
      })
    : [];
  return {
    source: 'backend',
    modelName: algorithm,
    target: String(roles?.data.config.target ?? 'configured outcome'),
    task: task === 'classification'
      ? classLabels.length > 2
        ? 'multiclass-classification'
        : 'binary-classification'
      : 'regression',
    splitSummary: `${String(split?.data.config.strategy ?? 'recorded')} split with ${Math.round(Number(split?.data.config.test_size ?? 0.2) * 100)}% held out; seed ${String(split?.data.config.random_seed ?? 'recorded')}`,
    metrics: Object.entries(metrics).map(([label, value]) =>
      metricFromValue(label.replaceAll('_', ' '), value, explanations[label]),
    ),
    comparison: [],
    residuals,
    generatedAt: response.finished_at,
    provenance: {
      runId: response.run_id,
      ...(response.workflow_hash ? { workflowHash: response.workflow_hash } : {}),
      ...(response.project_revision !== null && response.project_revision !== undefined
        ? { projectRevision: response.project_revision }
        : {}),
      ...(response.workflow_source ? { workflowSource: response.workflow_source } : {}),
    },
  };
};

const collectValidationIssues = (value: unknown, depth = 0): BackendValidationIssue[] => {
  if (depth > 5 || value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    const direct = value.filter((item): item is BackendValidationIssue => {
      if (!item || typeof item !== 'object') return false;
      const record = item as Record<string, unknown>;
      return typeof record.code === 'string' && typeof record.title === 'string';
    });
    if (direct.length > 0) return direct;
    return value.flatMap((item) => collectValidationIssues(item, depth + 1));
  }
  return Object.values(value as Record<string, unknown>).flatMap((item) =>
    collectValidationIssues(item, depth + 1),
  );
};

const mapValidationIssues = (issues: BackendValidationIssue[]): IntegrityWarning[] =>
  issues.map((issue, index) => ({
    id: `backend-${issue.code}-${index}`,
    ruleId: issue.code,
    severity: issue.severity === 'blocking_error' ? 'blocking' : issue.severity,
    title: issue.title,
    plainExplanation: issue.plain_explanation,
    technicalExplanation: issue.technical_explanation,
    evidence:
      typeof issue.evidence === 'string'
        ? issue.evidence
        : JSON.stringify(issue.evidence, null, 2),
    consequence: issue.likely_consequence,
    proposedRepair: issue.recommended_repair,
    repairEffect: 'If approved, LibreML applies the recorded patch and marks affected downstream artifacts stale.',
    affectedNodeIds: issue.node_ids,
    canAutoRepair: issue.automatic_repair_available,
    decision: 'pending',
    ...(issue.repair_patch ? { repairPatch: issue.repair_patch } : {}),
    source: 'backend',
  }));

export interface ExecutionController {
  runAll: () => Promise<void>;
  runSelected: (nodeId: string) => Promise<void>;
  cancel: () => Promise<void>;
}

export const useExecution = (): ExecutionController => {
  const cancelled = useRef(false);

  useEffect(() => {
    let active = true;
    void libreMlApi
      .health()
      .then(() => {
        if (active) useWorkspaceStore.getState().setBackendOnline(true);
      })
      .catch(() => {
        if (active) useWorkspaceStore.getState().setBackendOnline(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const run = useCallback(async (targetNodeId?: string): Promise<void> => {
    const initial = useWorkspaceStore.getState();
    if (initial.run.status === 'running' || initial.run.status === 'validating') return;
    cancelled.current = false;
    const nodesToRun = targetNodeId
      ? initial.nodes.filter((node) => node.id === targetNodeId)
      : topologicalOrder(initial.nodes);
    if (nodesToRun.length === 0) return;

    initial.setRun({ status: 'validating', progress: 0, message: 'Checking graph and methodology' });
    initial.setResults(null);
    initial.markAllNodes(targetNodeId ? 'idle' : 'queued');
    if (targetNodeId) initial.setNodeStatus(targetNodeId, 'queued');
    await delay(180);

    let online = initial.backendOnline;
    if (online === null) {
      try {
        await libreMlApi.health();
        online = true;
      } catch {
        online = false;
      }
      useWorkspaceStore.getState().setBackendOnline(online);
    }

    if (online) {
      try {
        let projectId = useWorkspaceStore.getState().project.id;
        if (projectId.startsWith('local-')) {
          const current = useWorkspaceStore.getState();
          const created = await libreMlApi.createProject({
            title: current.project.title,
            research_question: current.project.researchQuestion,
            mode: current.project.mode,
          });
          projectId = created.id;
          current.setProjectId(projectId);
        }
        const current = useWorkspaceStore.getState();
        const graph = toApiGraph(current.nodes, current.edges);
        await libreMlApi.saveWorkflow(projectId, graph);
        const validation = await libreMlApi.validateWorkflow(projectId, graph);
        const validationIssues = mapValidationIssues(collectValidationIssues(validation));
        current.setWarnings(validationIssues);
        if (validationIssues.some((issue) => issue.severity === 'blocking')) {
          current.markAllNodes('idle');
          current.setRun({
            status: 'failed',
            progress: 0,
            message: 'Run blocked by workflow validation',
            executionSource: 'backend',
          });
          current.appendAudit({
            kind: 'validation',
            title: 'Workflow blocked before execution',
            narrative: 'The local validation engine found a blocking issue. No nodes were executed and no demonstration artifacts were substituted.',
            actor: 'system',
            metadata: { blocking_issues: validationIssues.filter((issue) => issue.severity === 'blocking').length },
          });
          current.setActivePanel('integrity');
          return;
        }
        const clientRunId = crypto.randomUUID();
        current.setRun({
          id: clientRunId,
          status: 'running',
          progress: 0,
          startedAt: new Date().toISOString(),
          message: 'Running on the local Python engine',
          executionSource: 'backend',
        });
        const response = await libreMlApi.runWorkflow(
          projectId,
          graph,
          current.project.randomSeed,
          clientRunId,
          targetNodeId ? [targetNodeId] : undefined,
        );
        if (cancelled.current) return;
        const parsedResults = parseBackendResults(response, current.nodes);
        const nodeWarnings = response.node_results.flatMap((result) =>
          result.warnings.map((warning) => ({
            ...warning,
            node_ids: warning.node_ids.length > 0 ? warning.node_ids : [result.node_id],
          })),
        );
        const allWarnings = [...response.warnings, ...nodeWarnings].filter(
          (warning, index, collection) =>
            collection.findIndex(
              (candidate) =>
                candidate.code === warning.code &&
                candidate.node_ids.join('|') === warning.node_ids.join('|'),
            ) === index,
        );
        current.setWarnings(mapValidationIssues(allWarnings));
        for (const result of response.node_results) {
          const status =
            result.status === 'succeeded' || result.status === 'cached'
              ? 'success'
              : result.status === 'warning'
                ? 'warning'
                : result.status === 'stale' || result.status === 'cancelled'
                  ? 'stale'
                  : 'failed';
          current.setNodeStatus(result.node_id, status, undefined, result.duration_ms);
        }
        const returnedNodeIds = new Set(response.node_results.map((result) => result.node_id));
        if (response.status !== 'succeeded') {
          for (const node of current.nodes) {
            if (node.data.status === 'queued' && !returnedNodeIds.has(node.id)) {
              current.setNodeStatus(node.id, response.status === 'failed' ? 'failed' : 'stale');
            }
          }
        }
        if (parsedResults) current.setResults(parsedResults);
        const completed = response.status === 'succeeded';
        const finalStatus = response.status === 'cancelled' ? 'cancelled' : completed ? 'success' : 'failed';
        current.setRun({
          id: response.run_id,
          status: finalStatus,
          progress: 100,
          startedAt: response.started_at,
          message: completed ? 'Local workflow completed' : `Local workflow ${response.status}`,
          executionSource: 'backend',
        });
        current.appendAudit({
          kind: 'run',
          title: completed ? (targetNodeId ? 'Selected node completed' : 'Workflow completed') : 'Workflow did not complete',
          narrative: completed
            ? 'The workflow ran on the local Python engine. Parameters, versions, warnings, and artifacts were recorded.'
            : `The local engine returned ${response.status}. Review the node status and validation evidence before rerunning.`,
          actor: 'system',
          metadata: {
            run_id: response.run_id,
            source: 'backend',
            ...(response.workflow_hash ? { workflow_hash: response.workflow_hash } : {}),
            ...(response.project_revision !== null && response.project_revision !== undefined
              ? { project_revision: response.project_revision }
              : {}),
          },
        });
        current.setActivePanel(parsedResults ? 'results' : 'ledger');
        return;
      } catch (error) {
        const current = useWorkspaceStore.getState();
        if (error instanceof ApiError && error.status > 0) {
          current.setRun({
            status: 'failed',
            progress: current.run.progress,
            message: `Local engine rejected the run (${error.status})`,
            executionSource: 'backend',
          });
          current.nodes.forEach((node) => {
            if (node.data.status === 'running' || node.data.status === 'queued') {
              current.setNodeStatus(node.id, 'failed');
            }
          });
          current.notify({
            tone: 'danger',
            title: 'Run rejected by the local engine',
            message: error.message,
          });
          current.appendAudit({
            kind: 'run',
            title: 'Workflow run rejected',
            narrative: `The local engine returned HTTP ${error.status}. No demonstration artifacts were substituted. Review the reported validation or configuration error.`,
            actor: 'system',
            metadata: { http_status: error.status },
          });
          current.setActivePanel('integrity');
          return;
        }
        current.setBackendOnline(false);
        if (current.demoExecutionEnabled) {
          current.notify({
            tone: 'warning',
            title: 'Local engine unavailable',
            message: error instanceof Error
              ? `${error.message} The explicitly enabled bundled demonstration will run instead.`
              : 'The explicitly enabled bundled demonstration will run instead.',
          });
        }
      }
    }

    const current = useWorkspaceStore.getState();
    if (!current.demoExecutionEnabled) {
      current.markAllNodes('idle');
      current.setRun({
        status: 'failed',
        progress: 0,
        message: 'Local execution engine unavailable',
      });
      current.notify({
        tone: 'danger',
        title: 'Local engine unavailable',
        message: 'No sample results were substituted. Start the Python backend, or choose Load sample to explicitly enable the bundled browser demonstration.',
      });
      current.appendAudit({
        kind: 'run',
        title: 'Execution could not start',
        narrative: 'The local engine was unavailable. No nodes ran and no demonstration artifacts were substituted.',
        actor: 'system',
      });
      return;
    }
    current.setRun({
      status: 'running',
      progress: 8,
      startedAt: new Date().toISOString(),
      message: 'Demonstrating execution with bundled sample artifacts',
      executionSource: 'demo',
    });

    for (const [index, node] of nodesToRun.entries()) {
      if (cancelled.current) return;
      const started = performance.now();
      current.setNodeStatus(node.id, 'running', 35);
      current.setRun({
        status: 'running',
        progress: Math.round(((index + 0.35) / nodesToRun.length) * 100),
        currentNodeId: node.id,
        startedAt: current.run.startedAt ?? new Date().toISOString(),
        message: `Demonstrating ${node.data.label}`,
        executionSource: 'demo',
      });
      await delay(220 + (index % 3) * 45);
      if (cancelled.current) return;
      const unresolved = useWorkspaceStore
        .getState()
        .warnings.some((warning) => warning.decision === 'pending' && warning.affectedNodeIds.includes(node.id));
      current.setNodeStatus(
        node.id,
        unresolved && node.id === 'assign-roles' ? 'warning' : 'success',
        100,
        Math.round(performance.now() - started),
      );
    }

    if (!targetNodeId || targetNodeId === 'evaluate' || targetNodeId === 'report') {
      current.setResults({ ...SAMPLE_RESULTS, source: 'demo', generatedAt: new Date().toISOString() });
    }
    current.setRun({
      id: `demo-${crypto.randomUUID().slice(0, 8)}`,
      status: 'success',
      progress: 100,
      message: 'Bundled demonstration completed',
      executionSource: 'demo',
    });
    current.appendAudit({
      kind: 'run',
      title: 'Bundled demonstration completed',
      narrative:
        'The local Python engine was not available. LibreML demonstrated the interaction with explicitly labeled bundled sample artifacts; no fitted model was created.',
      actor: 'system',
      metadata: { source: 'demo' },
    });
    current.setActivePanel(!targetNodeId || targetNodeId === 'evaluate' ? 'results' : 'ledger');
  }, []);

  const cancel = useCallback(async (): Promise<void> => {
    cancelled.current = true;
    const state = useWorkspaceStore.getState();
    if (state.run.executionSource === 'backend' && state.run.id) {
      try {
        await libreMlApi.cancelRun(state.project.id, state.run.id);
      } catch {
        state.notify({
          tone: 'warning',
          title: 'Cancellation not confirmed',
          message: 'The local engine did not confirm cancellation. Check the run ledger before starting another run.',
        });
      }
    }
    state.nodes.forEach((node) => {
      if (node.data.status === 'running' || node.data.status === 'queued') state.setNodeStatus(node.id, 'stale');
    });
    state.setRun({ status: 'cancelled', progress: state.run.progress, message: 'Run cancelled by user' });
    state.appendAudit({
      kind: 'run',
      title: 'Run cancelled',
      narrative: 'Execution was cancelled by the user. Partial artifacts are not treated as final results.',
      actor: 'user',
    });
  }, []);

  return {
    runAll: () => run(),
    runSelected: (nodeId) => run(nodeId),
    cancel,
  };
};
