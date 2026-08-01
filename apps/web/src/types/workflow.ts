import type { Edge, Node } from '@xyflow/react';

export type WorkspaceMode = 'learning' | 'research';

export type PortType =
  | 'Dataset'
  | 'DatasetOverview'
  | 'LabeledDataset'
  | 'SplitDataset'
  | 'PreparedDataset'
  | 'RoleAssignedDataset'
  | 'DatasetPartitions'
  | 'FeatureMatrix'
  | 'TargetVector'
  | 'ModelDefinition'
  | 'TrainedModel'
  | 'Predictions'
  | 'Metrics'
  | 'FigureCollection'
  | 'StatisticalResult'
  | 'ReportArtifact';

export type NodeCategory =
  | 'Data sources'
  | 'Understand'
  | 'Prepare'
  | 'Split'
  | 'Models'
  | 'Evaluate'
  | 'Interpret'
  | 'Statistics'
  | 'Output';

export type NodeStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'success'
  | 'warning'
  | 'failed'
  | 'stale';

export type NodeIconKey =
  | 'database'
  | 'magnify'
  | 'broom'
  | 'split'
  | 'brain'
  | 'chart'
  | 'spark'
  | 'sigma'
  | 'file';

export interface NodePort {
  id: string;
  label: string;
  type: PortType;
  required?: boolean;
}

export interface SelectOption {
  label: string;
  value: string | number | boolean;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean';
  defaultValue: string | number | boolean;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: SelectOption[];
  advanced?: boolean;
}

export interface NodeSpec {
  type: string;
  version: number;
  name: string;
  category: NodeCategory;
  icon: NodeIconKey;
  summary: string;
  learningExplanation: string;
  researchExplanation: string;
  inputs: NodePort[];
  outputs: NodePort[];
  configFields: ConfigField[];
  available: boolean;
  keywords: string[];
}

export interface ResearchNodeData extends Record<string, unknown> {
  nodeType: string;
  label: string;
  category: NodeCategory;
  icon: NodeIconKey;
  summary: string;
  learningExplanation: string;
  researchExplanation: string;
  inputs: NodePort[];
  outputs: NodePort[];
  config: Record<string, string | number | boolean>;
  status: NodeStatus;
  durationMs?: number;
  warningCount: number;
  progress?: number;
}

export type WorkflowNode = Node<ResearchNodeData, 'researchNode'>;
export type WorkflowEdge = Edge<{ portType: PortType }, 'researchEdge'>;

export interface ProjectMetadata {
  id: string;
  title: string;
  researchQuestion: string;
  mode: WorkspaceMode;
  createdAt: string;
  updatedAt: string;
  randomSeed: number;
  analysisIntent: 'exploratory' | 'confirmatory';
}

export interface DatasetColumn {
  name: string;
  type: 'integer' | 'number' | 'string' | 'boolean' | 'date';
  missing: number;
  role?: 'feature' | 'target' | 'identifier' | 'unused';
}

export interface DatasetPreview {
  id: string;
  name: string;
  source: 'bundled-sample' | 'local-upload' | 'api';
  rowCount: number;
  columnCount: number;
  sampled: boolean;
  fingerprint: string;
  columns: DatasetColumn[];
  rows: Array<Record<string, string | number | boolean | null>>;
}

export type WarningSeverity = 'information' | 'caution' | 'warning' | 'blocking';
export type WarningDecision = 'pending' | 'approved' | 'modified' | 'rejected';

export interface IntegrityWarning {
  id: string;
  ruleId: string;
  severity: WarningSeverity;
  title: string;
  plainExplanation: string;
  technicalExplanation: string;
  evidence: string;
  consequence: string;
  proposedRepair: string;
  repairEffect: string;
  affectedNodeIds: string[];
  canAutoRepair: boolean;
  decision: WarningDecision;
  repairPatch?: Record<string, unknown>;
  source: 'bundled' | 'backend';
}

export interface MetricDatum {
  label: string;
  value: number;
  displayValue: string;
  direction: 'higher' | 'lower';
  explanation: string;
  caution: string;
}

export interface EvaluationResults {
  source: 'backend' | 'demo';
  modelName: string;
  target: string;
  task: 'regression' | 'binary-classification' | 'multiclass-classification';
  splitSummary: string;
  metrics: MetricDatum[];
  comparison: Array<{ model: string; rmse: number; mae: number }>;
  residuals: Array<{ predicted: number; residual: number }>;
  generatedAt: string;
  provenance?: {
    runId: string;
    workflowHash?: string;
    projectRevision?: number;
    workflowSource?: 'saved' | 'ad_hoc';
  };
}

export type AuditEventKind =
  | 'project'
  | 'dataset'
  | 'graph'
  | 'configuration'
  | 'validation'
  | 'repair'
  | 'run'
  | 'export';

export interface AuditEvent {
  id: string;
  timestamp: string;
  kind: AuditEventKind;
  title: string;
  narrative: string;
  actor: 'user' | 'system';
  metadata?: Record<string, string | number | boolean>;
}

export interface RunState {
  id?: string;
  status: 'idle' | 'validating' | 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  progress: number;
  currentNodeId?: string;
  startedAt?: string;
  message?: string;
  executionSource?: 'backend' | 'demo';
}

export interface ToastMessage {
  id: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
}

export interface GraphSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ApiWorkflowNode {
  id: string;
  type: string;
  version: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface ApiWorkflowEdge {
  id: string;
  source_node: string;
  source_port: string;
  target_node: string;
  target_port: string;
}

export interface ApiWorkflowGraph {
  schema_version: string;
  nodes: ApiWorkflowNode[];
  edges: ApiWorkflowEdge[];
}

export interface PredictionField {
  key: string;
  label: string;
  type: 'number' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  defaultValue: string | number;
}

export interface PredictionResult {
  value: number | string;
  explanation: string;
  source: 'backend' | 'demo';
}
