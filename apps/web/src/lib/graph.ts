import type { Connection } from '@xyflow/react';

import { defaultConfigForSpec, NODE_BY_TYPE } from '../data/catalog';
import type {
  ApiWorkflowGraph,
  NodeSpec,
  PortType,
  ResearchNodeData,
  WorkflowEdge,
  WorkflowNode,
} from '../types/workflow';

export interface ConnectionVerdict {
  valid: boolean;
  reason?: string;
  portType?: PortType;
}

export const createWorkflowNode = (
  spec: NodeSpec,
  position: { x: number; y: number },
  id = `${spec.type}-${crypto.randomUUID().slice(0, 8)}`,
): WorkflowNode => ({
  id,
  type: 'researchNode',
  position,
  data: {
    nodeType: spec.type,
    label: spec.name,
    category: spec.category,
    icon: spec.icon,
    summary: spec.summary,
    learningExplanation: spec.learningExplanation,
    researchExplanation: spec.researchExplanation,
    inputs: spec.inputs,
    outputs: spec.outputs,
    config: defaultConfigForSpec(spec),
    status: 'idle',
    warningCount: 0,
  },
});

const hasPath = (from: string, to: string, edges: WorkflowEdge[]): boolean => {
  const successors = new Map<string, string[]>();
  for (const edge of edges) {
    const current = successors.get(edge.source) ?? [];
    current.push(edge.target);
    successors.set(edge.source, current);
  }

  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === to) return true;
    seen.add(current);
    stack.push(...(successors.get(current) ?? []));
  }
  return false;
};

export const validateTypedConnection = (
  connection: Connection,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): ConnectionVerdict => {
  const { source, target, sourceHandle, targetHandle } = connection;
  if (!source || !target || !sourceHandle || !targetHandle) {
    return { valid: false, reason: 'Choose a named output and input port.' };
  }
  if (source === target) return { valid: false, reason: 'A node cannot connect to itself.' };

  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);
  if (!sourceNode || !targetNode) return { valid: false, reason: 'One of these nodes is no longer available.' };

  const sourcePort = sourceNode.data.outputs.find((port) => port.id === sourceHandle);
  const targetPort = targetNode.data.inputs.find((port) => port.id === targetHandle);
  if (!sourcePort || !targetPort) return { valid: false, reason: 'The selected port is not defined by this node.' };

  if (sourcePort.type !== targetPort.type) {
    return {
      valid: false,
      reason: `${sourcePort.label} provides ${sourcePort.type}, but ${targetPort.label} requires ${targetPort.type}.`,
    };
  }

  if (
    edges.some(
      (edge) =>
        edge.source === source &&
        edge.sourceHandle === sourceHandle &&
        edge.target === target &&
        edge.targetHandle === targetHandle,
    )
  ) {
    return { valid: false, reason: 'This connection already exists.' };
  }

  if (edges.some((edge) => edge.target === target && edge.targetHandle === targetHandle)) {
    return { valid: false, reason: `${targetPort.label} already has an incoming connection.` };
  }

  if (hasPath(target, source, edges)) {
    return { valid: false, reason: 'This connection would create a cycle. LibreML workflows must be acyclic.' };
  }

  return { valid: true, portType: sourcePort.type };
};

export const makeWorkflowEdge = (connection: Connection, portType: PortType): WorkflowEdge => ({
  id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
  source: connection.source ?? '',
  target: connection.target ?? '',
  sourceHandle: connection.sourceHandle,
  targetHandle: connection.targetHandle,
  type: 'researchEdge',
  data: { portType },
});

const commaList = (value: string | number | boolean | undefined): string[] =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const normalizeNodeConfig = (
  nodeType: string,
  config: Record<string, string | number | boolean>,
): Record<string, unknown> => {
  if (nodeType === 'assign_roles') {
    return {
      ...config,
      features: commaList(config.features),
      ignored: commaList(config.ignored),
    };
  }
  if (nodeType === 'model_definition') {
    const { max_iter, ...rest } = config;
    return {
      ...rest,
      parameters: { max_iter: Number(max_iter ?? 2000) },
    };
  }
  if (nodeType === 'evaluate_model' && String(config.positive_class ?? '').trim() === '') {
    const normalized = { ...config };
    delete normalized.positive_class;
    return normalized;
  }
  if (nodeType === 'generate_report') {
    return {
      ...config,
      limitations: String(config.limitations ?? '')
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }
  return config;
};

export const toApiGraph = (nodes: WorkflowNode[], edges: WorkflowEdge[]): ApiWorkflowGraph => ({
  schema_version: '1.0',
  nodes: nodes.map((node) => ({
    id: node.id,
    type: node.data.nodeType,
    version: `${NODE_BY_TYPE.get(node.data.nodeType)?.version ?? 1}.0.0`,
    config: normalizeNodeConfig(node.data.nodeType, node.data.config),
    position: { x: node.position.x, y: node.position.y },
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    source_node: edge.source,
    source_port: edge.sourceHandle ?? 'output',
    target_node: edge.target,
    target_port: edge.targetHandle ?? 'input',
  })),
});

const configForUi = (nodeType: string, value: unknown): Record<string, string | number | boolean> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const normalized: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(raw)) {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') normalized[key] = item;
    else if (Array.isArray(item)) normalized[key] = item.map(String).join(', ');
  }
  if (nodeType === 'model_definition' && raw.parameters && typeof raw.parameters === 'object') {
    const parameters = raw.parameters as Record<string, unknown>;
    if (typeof parameters.max_iter === 'number') normalized.max_iter = parameters.max_iter;
    if (typeof parameters.alpha === 'number') normalized.alpha = parameters.alpha;
  }
  if (nodeType === 'generate_report' && Array.isArray(raw.limitations)) {
    normalized.limitations = raw.limitations.map(String).join('\n');
  }
  return normalized;
};

export const fromApiGraph = (
  value: unknown,
  staleNodeIds: string[] = [],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null => {
  if (!value || typeof value !== 'object') return null;
  const graph = value as Record<string, unknown>;
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return null;
  const nodes: WorkflowNode[] = [];
  for (const candidate of graph.nodes) {
    if (!candidate || typeof candidate !== 'object') return null;
    const item = candidate as Record<string, unknown>;
    if (typeof item.id !== 'string' || typeof item.type !== 'string') return null;
    const bundled = NODE_BY_TYPE.get(item.type);
    if (!bundled) return null;
    const positionValue = item.position && typeof item.position === 'object'
      ? item.position as Record<string, unknown>
      : {};
    const node = createWorkflowNode(
      bundled,
      {
        x: typeof positionValue.x === 'number' ? positionValue.x : nodes.length * 280,
        y: typeof positionValue.y === 'number' ? positionValue.y : 180,
      },
      item.id,
    );
    node.data.config = { ...node.data.config, ...configForUi(item.type, item.config) };
    node.data.status = staleNodeIds.includes(item.id) ? 'stale' : 'idle';
    nodes.push(node);
  }
  const edges: WorkflowEdge[] = [];
  for (const candidate of graph.edges) {
    if (!candidate || typeof candidate !== 'object') return null;
    const item = candidate as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      typeof item.source_node !== 'string' ||
      typeof item.target_node !== 'string' ||
      typeof item.source_port !== 'string' ||
      typeof item.target_port !== 'string'
    ) return null;
    const source = nodes.find((node) => node.id === item.source_node);
    const target = nodes.find((node) => node.id === item.target_node);
    const portType = source?.data.outputs.find((port) => port.id === item.source_port)?.type
      ?? target?.data.inputs.find((port) => port.id === item.target_port)?.type;
    if (!portType) return null;
    edges.push({
      id: item.id,
      source: item.source_node,
      target: item.target_node,
      sourceHandle: item.source_port,
      targetHandle: item.target_port,
      type: 'researchEdge',
      data: { portType },
    });
  }
  return { nodes, edges };
};

export const getDownstreamNodeIds = (startIds: string[], edges: WorkflowEdge[]): string[] => {
  const downstream = new Set(startIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (downstream.has(edge.source) && !downstream.has(edge.target)) {
        downstream.add(edge.target);
        changed = true;
      }
    }
  }
  return [...downstream];
};

const spec = (type: string): NodeSpec => {
  const result = NODE_BY_TYPE.get(type);
  if (!result) throw new Error(`Unknown bundled node type: ${type}`);
  return result;
};

export const createDemoGraph = (): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => {
  const nodes = [
    createWorkflowNode(spec('csv_import'), { x: 30, y: 210 }, 'csv-source'),
    createWorkflowNode(spec('dataset_overview'), { x: 320, y: 20 }, 'overview'),
    createWorkflowNode(spec('assign_roles'), { x: 320, y: 310 }, 'assign-roles'),
    createWorkflowNode(spec('train_test_split'), { x: 610, y: 310 }, 'split-data'),
    createWorkflowNode(spec('tabular_preprocess'), { x: 900, y: 310 }, 'preprocess'),
    createWorkflowNode(spec('model_definition'), { x: 900, y: 570 }, 'model-definition'),
    createWorkflowNode(spec('train_model'), { x: 1190, y: 390 }, 'train-model'),
    createWorkflowNode(spec('evaluate_model'), { x: 1480, y: 390 }, 'evaluate'),
    createWorkflowNode(spec('generate_report'), { x: 1770, y: 390 }, 'report'),
  ];
  const roleNode = nodes.find((node) => node.id === 'assign-roles');
  if (roleNode) roleNode.data.warningCount = 1;

  const connect = (
    id: string,
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string,
    portType: PortType,
  ): WorkflowEdge => ({
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'researchEdge',
    data: { portType },
  });

  const edges = [
    connect('e-source-overview', 'csv-source', 'dataset', 'overview', 'dataset', 'Dataset'),
    connect('e-overview-roles', 'overview', 'dataset', 'assign-roles', 'dataset', 'Dataset'),
    connect('e-roles-split', 'assign-roles', 'labeled_dataset', 'split-data', 'labeled_dataset', 'LabeledDataset'),
    connect('e-split-preprocess', 'split-data', 'split_dataset', 'preprocess', 'split_dataset', 'SplitDataset'),
    connect('e-preprocess-train', 'preprocess', 'prepared_dataset', 'train-model', 'prepared_dataset', 'PreparedDataset'),
    connect('e-model-train', 'model-definition', 'model_definition', 'train-model', 'model_definition', 'ModelDefinition'),
    connect('e-train-evaluate', 'train-model', 'trained_model', 'evaluate', 'trained_model', 'TrainedModel'),
    connect('e-evaluate-report', 'evaluate', 'metrics', 'report', 'metrics', 'Metrics'),
  ];

  return { nodes, edges };
};

export const hydrateNodeData = (data: ResearchNodeData): ResearchNodeData => {
  const bundled = NODE_BY_TYPE.get(data.nodeType);
  if (!bundled) return data;
  return {
    ...data,
    label: bundled.name,
    category: bundled.category,
    icon: bundled.icon,
    summary: bundled.summary,
    learningExplanation: bundled.learningExplanation,
    researchExplanation: bundled.researchExplanation,
    inputs: bundled.inputs,
    outputs: bundled.outputs,
  };
};
