import { beforeEach, describe, expect, it } from 'vitest';

import { SAMPLE_RESULTS, SAMPLE_WARNING } from '../data/sample';
import { createDemoGraph } from '../lib/graph';
import { useWorkspaceStore } from './workspace';

describe('workspace state', () => {
  beforeEach(() => {
    const graph = createDemoGraph();
    useWorkspaceStore.setState({
      nodes: graph.nodes,
      edges: graph.edges,
      selectedNodeId: 'assign-roles',
      warnings: [{ ...SAMPLE_WARNING, repairPatch: { ...SAMPLE_WARNING.repairPatch } }],
      results: { ...SAMPLE_RESULTS },
      past: [],
      future: [],
      demoExecutionEnabled: true,
      run: { status: 'idle', progress: 0 },
    });
  });

  it('applies an approved leakage repair and clears stale results', () => {
    useWorkspaceStore.getState().approveRepair(SAMPLE_WARNING.id);
    const state = useWorkspaceStore.getState();
    const roles = state.nodes.find((node) => node.id === 'assign-roles');

    expect(String(roles?.data.config.features)).not.toContain('outcome_proxy');
    expect(String(roles?.data.config.ignored)).toContain('outcome_proxy');
    expect(roles?.data.status).toBe('stale');
    expect(state.results).toBeNull();
    expect(state.warnings[0]?.decision).toBe('approved');
  });

  it('clears results when a consequential configuration changes', () => {
    useWorkspaceStore.getState().updateNodeConfig('split-data', 'test_size', 0.3);
    const state = useWorkspaceStore.getState();
    expect(state.results).toBeNull();
    expect(state.nodes.find((node) => node.id === 'split-data')?.data.config.test_size).toBe(0.3);
    expect(state.past.length).toBe(1);
  });

  it('switches guidance mode without replacing the graph', () => {
    const ids = useWorkspaceStore.getState().nodes.map((node) => node.id);
    useWorkspaceStore.getState().setMode('learning');
    expect(useWorkspaceStore.getState().project.mode).toBe('learning');
    expect(useWorkspaceStore.getState().nodes.map((node) => node.id)).toEqual(ids);
  });
});
