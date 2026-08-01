import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SAMPLE_RESULTS } from '../data/sample';
import { createDemoGraph } from '../lib/graph';
import { useWorkspaceStore } from '../store/workspace';
import { useExecution } from './useExecution';

describe('workflow execution safety', () => {
  beforeEach(() => {
    const graph = createDemoGraph();
    useWorkspaceStore.setState((state) => ({
      ...state,
      project: { ...state.project, id: 'server-project' },
      nodes: graph.nodes,
      edges: graph.edges,
      results: { ...SAMPLE_RESULTS },
      run: { status: 'idle', progress: 0 },
      backendOnline: null,
      demoExecutionEnabled: true,
      audit: [],
      toasts: [],
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('never substitutes demo success after a backend validation response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', version: '0.1.0', local_only: true, storage: 'local' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Invalid workflow configuration' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useExecution());
    await waitFor(() => expect(useWorkspaceStore.getState().backendOnline).toBe(true));
    await act(async () => result.current.runAll());

    const state = useWorkspaceStore.getState();
    expect(state.run.status).toBe('failed');
    expect(state.run.executionSource).toBe('backend');
    expect(state.results).toBeNull();
    expect(state.audit.some((event) => event.title === 'Bundled demonstration completed')).toBe(false);
    expect(state.toasts.at(-1)?.title).toBe('Run rejected by the local engine');
  });
});
