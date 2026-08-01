import type { Connection } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { NODE_BY_TYPE } from '../data/catalog';
import {
  createDemoGraph,
  createWorkflowNode,
  makeWorkflowEdge,
  toApiGraph,
  validateTypedConnection,
} from './graph';

describe('typed workflow graph', () => {
  it('serializes the bundled golden path to the backend contract', () => {
    const graph = createDemoGraph();
    const api = toApiGraph(graph.nodes, graph.edges);

    const source = api.nodes.find((node) => node.type === 'csv_import');
    const roles = api.nodes.find((node) => node.type === 'assign_roles');
    const model = api.nodes.find((node) => node.type === 'model_definition');

    expect(source?.version).toBe('1.0.0');
    expect(source?.config.path).toBe('bundled:community_learning_outcomes.csv');
    expect(roles?.config).toMatchObject({
      task: 'classification',
      target: 'completed_program',
      ignored: ['participant_id'],
    });
    expect(roles?.config.features).toContain('outcome_proxy');
    expect(model?.config).toMatchObject({
      task: 'classification',
      algorithm: 'logistic_regression',
      parameters: { max_iter: 2000 },
    });
    expect(api.edges).toContainEqual(
      expect.objectContaining({
        source_node: 'overview',
        source_port: 'dataset',
        target_node: 'assign-roles',
        target_port: 'dataset',
      }),
    );
  });

  it('rejects incompatible ports immediately', () => {
    const { nodes, edges } = createDemoGraph();
    const connection: Connection = {
      source: 'csv-source',
      sourceHandle: 'dataset',
      target: 'train-model',
      targetHandle: 'model_definition',
    };
    const verdict = validateTypedConnection(connection, nodes, edges);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toContain('requires ModelDefinition');
  });

  it('rejects a connection that would create a cycle', () => {
    const selectSpec = NODE_BY_TYPE.get('select_columns');
    if (!selectSpec) throw new Error('Select columns spec missing');
    const first = createWorkflowNode(selectSpec, { x: 0, y: 0 }, 'first');
    const second = createWorkflowNode(selectSpec, { x: 200, y: 0 }, 'second');
    const existing = makeWorkflowEdge(
      { source: 'first', sourceHandle: 'dataset', target: 'second', targetHandle: 'dataset' },
      'Dataset',
    );
    const verdict = validateTypedConnection(
      { source: 'second', sourceHandle: 'dataset', target: 'first', targetHandle: 'dataset' },
      [first, second],
      [existing],
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toContain('cycle');
  });
});
