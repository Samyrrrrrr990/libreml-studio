import { describe, expect, it } from 'vitest';

import { PORT_FAMILY_LABELS, portColorClass, portFamily } from './portFamily';
import type { PortType } from '../types/workflow';

/**
 * Every port type in the wire contract must map to a family.
 *
 * Kept in sync by hand with `PortType`, so that adding a port type to the
 * union without giving it a colour fails here rather than shipping a node
 * whose handles silently render in the fallback grey.
 */
const ALL_PORT_TYPES: PortType[] = [
  'Dataset',
  'DatasetOverview',
  'LabeledDataset',
  'SplitDataset',
  'PreparedDataset',
  'RoleAssignedDataset',
  'DatasetPartitions',
  'FeatureMatrix',
  'TargetVector',
  'ModelDefinition',
  'TrainedModel',
  'Predictions',
  'Metrics',
  'FigureCollection',
  'StatisticalResult',
  'ReportArtifact',
];

describe('portFamily', () => {
  it('assigns every declared port type to a non-generic family', () => {
    const unmapped = ALL_PORT_TYPES.filter((type) => portFamily(type) === 'generic');
    expect(unmapped).toEqual([]);
  });

  it('groups dataset-shaped types together', () => {
    expect(portFamily('Dataset')).toBe('dataset');
    expect(portFamily('SplitDataset')).toBe('dataset');
    expect(portFamily('TargetVector')).toBe('dataset');
  });

  it('separates models, measurements, and artifacts', () => {
    expect(portFamily('TrainedModel')).toBe('model');
    expect(portFamily('Metrics')).toBe('metrics');
    expect(portFamily('ReportArtifact')).toBe('report');
  });

  it('falls back to generic for an absent or unknown type', () => {
    expect(portFamily(undefined)).toBe('generic');
    expect(portFamily('NotARealType' as PortType)).toBe('generic');
  });

  it('emits a class name matching a defined colour token', () => {
    expect(portColorClass('Metrics')).toBe('port-color-metrics');
    expect(portColorClass(undefined)).toBe('port-color-generic');
  });

  it('labels every family the canvas legend renders', () => {
    expect(Object.keys(PORT_FAMILY_LABELS).sort()).toEqual([
      'dataset',
      'metrics',
      'model',
      'report',
    ]);
  });
});
