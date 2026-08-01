import type { ApiWorkflowGraph, WorkspaceMode } from '../types/workflow';

const API_BASE = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const request = async <T>(path: string, init?: RequestInit, responseMode: 'json' | 'text' = 'json'): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new ApiError(body || `Local backend returned ${response.status}.`, response.status);
  }
  if (responseMode === 'text') return (await response.text()) as T;
  return (await response.json()) as T;
};

export interface HealthResponse {
  status: string;
  version: string;
  local_only: boolean;
  storage: string;
}

export interface BackendProject {
  id: string;
  title: string;
  research_question?: string;
  mode: WorkspaceMode;
}

export interface BackendRunResult {
  run_id: string;
  status: 'succeeded' | 'blocked' | 'failed' | 'cancelled';
  node_results: Array<{
    node_id: string;
    status: 'succeeded' | 'warning' | 'failed' | 'cancelled' | 'cached' | 'stale';
    duration_ms: number;
    cache_key?: string;
    error?: string;
    output_ports: string[];
    warnings: BackendValidationIssue[];
  }>;
  artifacts: Array<{
    node_id: string;
    port: string;
    type: string;
    fingerprint: string;
    preview: unknown;
  }>;
  warnings: BackendValidationIssue[];
  started_at: string;
  finished_at: string;
  workflow_hash?: string | null;
  project_revision?: number | null;
  workflow_source?: 'saved' | 'ad_hoc';
}

export interface BackendValidationIssue {
  code: string;
  severity: 'information' | 'caution' | 'warning' | 'blocking_error';
  title: string;
  plain_explanation: string;
  technical_explanation: string;
  evidence: unknown;
  likely_consequence: string;
  recommended_repair: string;
  automatic_repair_available: boolean;
  node_ids: string[];
  repair_patch?: Record<string, unknown>;
}

export interface BackendRepairResponse {
  applied: boolean;
  workflow: ApiWorkflowGraph;
  stale_node_ids: string[];
}

export const libreMlApi = {
  health: (): Promise<HealthResponse> => request('/health'),

  createProject: (body: {
    title: string;
    research_question: string;
    mode: WorkspaceMode;
  }): Promise<BackendProject> => request('/projects', { method: 'POST', body: JSON.stringify(body) }),

  saveWorkflow: (projectId: string, graph: ApiWorkflowGraph): Promise<unknown> =>
    request(`/projects/${encodeURIComponent(projectId)}/workflow`, {
      method: 'PUT',
      body: JSON.stringify(graph),
    }),

  validateWorkflow: (projectId: string, graph: ApiWorkflowGraph): Promise<unknown> =>
    request(`/projects/${encodeURIComponent(projectId)}/workflow/validate`, {
      method: 'POST',
      body: JSON.stringify(graph),
    }),

  uploadDataset: async (projectId: string, file: File): Promise<unknown> => {
    const body = new FormData();
    body.append('file', file);
    body.append('source_type', file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'excel');
    return request(`/projects/${encodeURIComponent(projectId)}/imports`, { method: 'POST', body });
  },

  runWorkflow: (
    projectId: string,
    graph: ApiWorkflowGraph,
    randomSeed: number,
    runId: string,
    targetNodeIds?: string[],
  ): Promise<BackendRunResult> =>
    request(`/projects/${encodeURIComponent(projectId)}/runs`, {
      method: 'POST',
      body: JSON.stringify({
        workflow: graph,
        random_seed: randomSeed,
        run_id: runId,
        ...(targetNodeIds ? { target_node_ids: targetNodeIds } : {}),
      }),
    }),

  cancelRun: (projectId: string, runId: string): Promise<unknown> =>
    request(`/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
    }),

  predict: (
    projectId: string,
    trainedNodeId: string,
    rows: Array<Record<string, string | number | boolean>>,
  ): Promise<{ predictions: Array<string | number>; probabilities?: Array<Record<string, number>>; classes?: string[]; warning?: string }> =>
    request(
      `/projects/${encodeURIComponent(projectId)}/predictions/${encodeURIComponent(trainedNodeId)}`,
      { method: 'POST', body: JSON.stringify({ rows }) },
    ),

  getReport: (
    projectId: string,
    reportNodeId: string,
    format: 'html' | 'markdown' | 'json',
  ): Promise<string | Record<string, unknown>> => {
    const path = `/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportNodeId)}?format=${format}`;
    return format === 'json'
      ? request<Record<string, unknown>>(path)
      : request<string>(path, undefined, 'text');
  },

  applyRepair: (
    projectId: string,
    body: {
      warning_code: string;
      node_id: string;
      decision: 'approve' | 'reject';
      repair_patch?: Record<string, unknown>;
    },
  ): Promise<BackendRepairResponse> =>
    request(`/projects/${encodeURIComponent(projectId)}/repairs`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
