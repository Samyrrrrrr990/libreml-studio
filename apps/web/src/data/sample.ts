import type {
  AuditEvent,
  DatasetPreview,
  EvaluationResults,
  IntegrityWarning,
  PredictionField,
} from '../types/workflow';

export const SAMPLE_DATASET: DatasetPreview = {
  id: 'community-learning-outcomes',
  name: 'Community learning outcomes',
  source: 'bundled-sample',
  rowCount: 120,
  columnCount: 8,
  sampled: true,
  fingerprint: 'sha256:6024475d9d46…819735e',
  columns: [
    { name: 'participant_id', type: 'string', missing: 0, role: 'identifier' },
    { name: 'age', type: 'integer', missing: 0, role: 'feature' },
    { name: 'hours_studied', type: 'integer', missing: 0, role: 'feature' },
    { name: 'attendance_rate', type: 'integer', missing: 0, role: 'feature' },
    { name: 'prior_score', type: 'integer', missing: 0, role: 'feature' },
    { name: 'program_type', type: 'string', missing: 0, role: 'feature' },
    { name: 'completed_program', type: 'integer', missing: 0, role: 'target' },
    { name: 'outcome_proxy', type: 'integer', missing: 0, role: 'unused' },
  ],
  rows: [
    { participant_id: 'P001', age: 25, hours_studied: 5, attendance_rate: 66, prior_score: 58, program_type: 'cohort', completed_program: 0, outcome_proxy: 0 },
    { participant_id: 'P002', age: 32, hours_studied: 8, attendance_rate: 77, prior_score: 71, program_type: 'mentored', completed_program: 0, outcome_proxy: 0 },
    { participant_id: 'P003', age: 39, hours_studied: 11, attendance_rate: 88, prior_score: 84, program_type: 'self_guided', completed_program: 1, outcome_proxy: 1 },
    { participant_id: 'P004', age: 46, hours_studied: 14, attendance_rate: 55, prior_score: 46, program_type: 'cohort', completed_program: 0, outcome_proxy: 0 },
    { participant_id: 'P005', age: 53, hours_studied: 17, attendance_rate: 66, prior_score: 59, program_type: 'mentored', completed_program: 1, outcome_proxy: 1 },
    { participant_id: 'P006', age: 60, hours_studied: 20, attendance_rate: 77, prior_score: 72, program_type: 'self_guided', completed_program: 1, outcome_proxy: 1 },
    { participant_id: 'P007', age: 24, hours_studied: 4, attendance_rate: 88, prior_score: 85, program_type: 'cohort', completed_program: 0, outcome_proxy: 0 },
    { participant_id: 'P008', age: 31, hours_studied: 7, attendance_rate: 55, prior_score: 47, program_type: 'mentored', completed_program: 0, outcome_proxy: 0 },
  ],
};

export const SAMPLE_WARNING: IntegrityWarning = {
  id: 'warning-direct-leakage',
  ruleId: 'direct_target_leakage',
  severity: 'blocking',
  title: 'Target leakage through outcome_proxy',
  plainExplanation:
    'outcome_proxy reproduces the completion outcome. A model given this value would already know the answer it is meant to predict.',
  technicalExplanation:
    'outcome_proxy exactly matches completed_program in all 120 bundled rows. This is direct target leakage and invalidates holdout evaluation.',
  evidence: 'outcome_proxy matches completed_program in 120 of 120 rows.',
  consequence: 'Reported model performance would be invalid because the predictors contain the target itself.',
  proposedRepair: 'Remove outcome_proxy from predictors and place it in ignored columns.',
  repairEffect: 'The Assign roles node changes, then Split and all downstream nodes become stale.',
  affectedNodeIds: ['assign-roles', 'split-data', 'preprocess', 'train-model', 'evaluate', 'report'],
  canAutoRepair: true,
  decision: 'pending',
  repairPatch: { action: 'remove_feature', column: 'outcome_proxy' },
  source: 'bundled',
};

export const SAMPLE_RESULTS: EvaluationResults = {
  source: 'demo',
  modelName: 'Logistic regression',
  target: 'completed_program',
  task: 'binary-classification',
  splitSummary: 'Stratified 80% training, 20% held-out test; seed 17',
  metrics: [
    {
      label: 'Balanced accuracy',
      value: 0.83,
      displayValue: '0.83',
      direction: 'higher',
      explanation: 'Average accuracy across completion and non-completion classes.',
      caution: 'Compare with class balance and inspect per-class recall.',
    },
    {
      label: 'F1 score',
      value: 0.82,
      displayValue: '0.82',
      direction: 'higher',
      explanation: 'Balances precision and recall for classification decisions.',
      caution: 'Can hide different error costs and performance across groups.',
    },
    {
      label: 'Log loss',
      value: 0.41,
      displayValue: '0.41',
      direction: 'lower',
      explanation: 'Measures the quality of predicted probabilities and penalizes confident mistakes.',
      caution: 'Interpret with calibration and a simple baseline.',
    },
  ],
  comparison: [],
  residuals: [],
  generatedAt: new Date().toISOString(),
};

export const INITIAL_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'audit-project-created',
    timestamp: new Date(Date.now() - 120_000).toISOString(),
    kind: 'project',
    title: 'Project created',
    narrative: 'A local Research Mode project was created with random seed 17.',
    actor: 'user',
  },
  {
    id: 'audit-sample-loaded',
    timestamp: new Date(Date.now() - 90_000).toISOString(),
    kind: 'dataset',
    title: 'Bundled sample loaded',
    narrative:
      'Community learning outcomes was loaded from the bundled example library. The full dataset remains on this device.',
    actor: 'user',
    metadata: { rows: 120, columns: 8 },
  },
  {
    id: 'audit-validation',
    timestamp: new Date(Date.now() - 60_000).toISOString(),
    kind: 'validation',
    title: 'Integrity check completed',
    narrative: 'The workflow validator found one unresolved methodological warning.',
    actor: 'system',
    metadata: { warnings: 1 },
  },
];

export const PREDICTION_FIELDS: PredictionField[] = [
  { key: 'age', label: 'Age', type: 'number', min: 16, max: 90, step: 1, defaultValue: 34 },
  {
    key: 'program_type',
    label: 'Program',
    type: 'select',
    options: ['cohort', 'mentored', 'self_guided'],
    defaultValue: 'mentored',
  },
  {
    key: 'hours_studied',
    label: 'Hours studied',
    type: 'number',
    min: 0,
    max: 100,
    step: 0.1,
    defaultValue: 12,
  },
  {
    key: 'attendance_rate',
    label: 'Attendance rate',
    type: 'number',
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 82,
  },
  {
    key: 'prior_score',
    label: 'Prior score',
    type: 'number',
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 72,
  },
];
