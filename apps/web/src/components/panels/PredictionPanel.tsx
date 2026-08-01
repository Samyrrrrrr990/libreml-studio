import { DownloadSimple, Gauge, Play, UploadSimple, Warning } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';

import { PREDICTION_FIELDS } from '../../data/sample';
import { libreMlApi } from '../../lib/api';
import { useWorkspaceStore } from '../../store/workspace';
import type { PredictionResult } from '../../types/workflow';

const demonstrationPrediction = (row: Record<string, string | number | boolean>): number => {
  const priorScore = Number(row.prior_score ?? 0);
  const attendance = Number(row.attendance_rate ?? 0);
  const age = Number(row.age ?? 0);
  const hours = Number(row.hours_studied ?? 0);
  const program = String(row.program_type ?? '');
  const programAdjustment = program === 'mentored' ? 0.35 : program === 'self_guided' ? 0.12 : 0;
  const logit = -8.8 + priorScore * 0.055 + attendance * 0.035 + hours * 0.11 + age * 0.006 + programAdjustment;
  return 1 / (1 + Math.exp(-logit));
};

const csvCell = (value: string | number): string => {
  const raw = String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

const saveBatch = (predictions: Array<string | number>, source: string): void => {
  const rows = ['row,prediction,artifact_source', ...predictions.map((value, index) => `${index + 1},${csvCell(value)},${csvCell(source)}`)];
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'libreml-predictions.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

export function PredictionPanel() {
  const results = useWorkspaceStore((state) => state.results);
  const backendOnline = useWorkspaceStore((state) => state.backendOnline);
  const projectId = useWorkspaceStore((state) => state.project.id);
  const notify = useWorkspaceStore((state) => state.notify);
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(PREDICTION_FIELDS.map((field) => [field.key, field.defaultValue])),
  );
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [running, setRunning] = useState(false);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const trainNodeId = nodes.find((node) => node.data.nodeType === 'train_model')?.id;
  const roleNode = nodes.find((node) => node.data.nodeType === 'assign_roles');
  const configuredFeatures = String(roleNode?.data.config.features ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const expectedFeatures = PREDICTION_FIELDS.map((field) => field.key);
  const schemaCompatible =
    configuredFeatures.length === expectedFeatures.length &&
    expectedFeatures.every((field) => configuredFeatures.includes(field));

  const canUseBackend = backendOnline === true && results?.source === 'backend';
  const fieldSummary = useMemo(() => `${PREDICTION_FIELDS.length} validated fields`, []);

  const predict = async (): Promise<void> => {
    if (!results) return;
    for (const field of PREDICTION_FIELDS) {
      if (field.type !== 'number') continue;
      const value = Number(values[field.key]);
      const outsideRange =
        !Number.isFinite(value) ||
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max);
      if (outsideRange) {
        notify({
          tone: 'danger',
          title: 'Check prediction inputs',
          message: `${field.label} must be between ${field.min ?? 'its minimum'} and ${field.max ?? 'its maximum'}.`,
        });
        return;
      }
    }
    setRunning(true);
    try {
      if (canUseBackend) {
        if (!trainNodeId) throw new Error('Add and run a Train model node before predicting.');
        const response = await libreMlApi.predict(projectId, trainNodeId, [values]);
        const value = response.predictions[0];
        if (value === undefined) throw new Error('The local model returned no prediction.');
        setPrediction({
          value,
          explanation: response.warning ?? 'Calculated by the exact locally fitted preprocessing and model pipeline.',
          source: 'backend',
        });
      } else {
        const probability = demonstrationPrediction(values);
        setPrediction({
          value: `${probability >= 0.5 ? 'Likely completion' : 'Likely non-completion'} (${(probability * 100).toFixed(1)}%)`,
          explanation: 'Illustrative output from the bundled browser demonstration. No fitted model produced this value.',
          source: 'demo',
        });
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'Prediction failed', message: error instanceof Error ? error.message : 'The local model could not process these values.' });
    } finally {
      setRunning(false);
    }
  };

  if (!results) {
    return (
      <div className="panel-empty-state">
        <Gauge size={30} weight="duotone" />
        <strong>No trained pipeline available</strong>
        <span>Complete model training and evaluation before opening the prediction interface.</span>
      </div>
    );
  }

  if (!schemaCompatible) {
    return (
      <div className="panel-empty-state">
        <Gauge size={30} weight="duotone" />
        <strong>Prediction schema needs regeneration</strong>
        <span>This form is scoped to the bundled completion workflow. Restore its five reviewed features or use a backend-provided input schema before predicting.</span>
      </div>
    );
  }

  return (
    <div className="prediction-panel">
      <section className="prediction-form-section">
        <header>
          <div><span>Interactive model</span><h3>Predict {results.target}</h3><p>{fieldSummary}. Uses the complete preprocessing pipeline.</p></div>
          <button className="button button-quiet button-compact" type="button" disabled title="Batch prediction requires a full, schema-validated parser and is intentionally disabled in this release.">
            <UploadSimple size={15} weight="bold" />
            Batch CSV unavailable
          </button>
        </header>
        <div className="prediction-fields">
          {PREDICTION_FIELDS.map((field) => (
            <label className="form-field" key={field.key}>
              <span>{field.label}</span>
              {field.type === 'select' ? (
                <select value={String(values[field.key])} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>
                  {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  type="number"
                  value={String(values[field.key])}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
                />
              )}
            </label>
          ))}
        </div>
        <button className="button button-primary prediction-submit" type="button" onClick={() => void predict()} disabled={running}>
          <Play size={15} weight="fill" />
          {running ? 'Calculating…' : 'Calculate prediction'}
        </button>
      </section>

      <aside className={`prediction-output${prediction ? ' has-result' : ''}`} aria-live="polite">
        {prediction ? (
          <>
            <span>{prediction.source === 'backend' ? 'Local model prediction' : 'Bundled demo prediction'}</span>
            <strong>{prediction.value}</strong>
            <p>{prediction.explanation}</p>
            <button className="button button-quiet button-compact" type="button" onClick={() => saveBatch([prediction.value], prediction.source)}>
              <DownloadSimple size={15} weight="bold" />
              Export result
            </button>
          </>
        ) : (
          <><Gauge size={28} weight="duotone" /><strong>Ready for reviewed inputs</strong><p>Enter one plausible scenario. LibreML validates ranges before inference.</p></>
        )}
        <div className="prediction-caution">
          <Warning size={16} weight="fill" />
          A prediction is not proof of causation and should not be used as an unreviewed decision.
        </div>
      </aside>
    </div>
  );
}
