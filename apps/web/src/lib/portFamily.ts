import type { PortType } from '../types/workflow';

/**
 * Port types collapsed into four visual families.
 *
 * The typed graph has sixteen port types, which is the right resolution for
 * validation but far too many to encode as distinct hues on a canvas: nobody
 * can hold sixteen colours in working memory, and adjacent hues would imply a
 * similarity the type system does not guarantee. Grouping into families gives
 * the user a reliable read of what flows along an edge (data, a model, a
 * measurement, an artifact) while the exact type stays available on hover and
 * in the inspector.
 */
export type PortFamily = 'dataset' | 'model' | 'metrics' | 'report' | 'generic';

const FAMILY_BY_TYPE: Record<PortType, PortFamily> = {
  Dataset: 'dataset',
  DatasetOverview: 'dataset',
  LabeledDataset: 'dataset',
  SplitDataset: 'dataset',
  PreparedDataset: 'dataset',
  RoleAssignedDataset: 'dataset',
  DatasetPartitions: 'dataset',
  FeatureMatrix: 'dataset',
  TargetVector: 'dataset',
  ModelDefinition: 'model',
  TrainedModel: 'model',
  Predictions: 'metrics',
  Metrics: 'metrics',
  StatisticalResult: 'metrics',
  FigureCollection: 'report',
  ReportArtifact: 'report',
};

/** Human-readable description of each family, used by the canvas legend. */
export const PORT_FAMILY_LABELS: Record<Exclude<PortFamily, 'generic'>, string> = {
  dataset: 'Data',
  model: 'Model',
  metrics: 'Results',
  report: 'Artifacts',
};

export const portFamily = (type: PortType | undefined): PortFamily =>
  type ? (FAMILY_BY_TYPE[type] ?? 'generic') : 'generic';

/** CSS class that binds `--port-color` for handles, edges, and legend swatches. */
export const portColorClass = (type: PortType | undefined): string =>
  `port-color-${portFamily(type)}`;
