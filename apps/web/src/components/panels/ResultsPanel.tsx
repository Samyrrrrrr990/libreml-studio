import { ChartLine, Flask, Play } from '@phosphor-icons/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useWorkspaceStore } from '../../store/workspace';

interface ResultsPanelProps {
  onRun: () => Promise<void>;
}

export function ResultsPanel({ onRun }: ResultsPanelProps) {
  const results = useWorkspaceStore((state) => state.results);
  const mode = useWorkspaceStore((state) => state.project.mode);
  const runStatus = useWorkspaceStore((state) => state.run.status);
  if (!results) {
    return (
      <div className="panel-empty-state">
        <ChartLine size={30} weight="duotone" />
        <strong>No evaluation artifact yet</strong>
        <span>Run the complete typed workflow to calculate held-out metrics and diagnostic figures.</span>
        <button className="button button-primary" type="button" onClick={() => void onRun()} disabled={runStatus === 'running' || runStatus === 'validating'}>
          <Play size={15} weight="fill" />
          Run workflow
        </button>
      </div>
    );
  }

  return (
    <div className="results-panel">
      <header className="results-heading">
        <div>
          <span>{results.modelName}</span>
          <h3>Held-out evaluation</h3>
          <p>Target: <code>{results.target}</code>. {results.splitSummary}.</p>
        </div>
        <span className={`artifact-source source-${results.source}`}>
          {results.source === 'demo' ? <Flask size={15} weight="bold" /> : <ChartLine size={15} weight="bold" />}
          {results.source === 'demo' ? 'Bundled demo artifact' : 'Local engine artifact'}
        </span>
      </header>

      {results.source === 'demo' ? (
        <div className="demo-notice">
          <Flask size={17} weight="duotone" />
          <span><strong>Illustrative result only.</strong> The Python execution engine was unavailable, so these are bundled sample values, not a model fitted in this session.</span>
        </div>
      ) : null}

      <div className="metric-strip">
        {results.metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.displayValue}</strong>
            <p>{mode === 'learning' ? metric.explanation : metric.caution}</p>
            <small>{metric.direction === 'higher' ? 'Higher is usually better' : 'Lower is usually better'}</small>
          </article>
        ))}
      </div>

      <div className="result-figures">
        {results.comparison.length > 0 ? (
          <figure aria-labelledby="comparison-title">
            <figcaption>
              <strong id="comparison-title">Model comparison</strong>
              <span>Held-out RMSE in outcome points. Lower is better.</span>
            </figcaption>
            <div className="chart-frame" role="img" aria-label="Bar chart comparing held-out root mean squared error across candidate models">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.comparison} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#d8d1c5" />
                  <XAxis dataKey="model" tick={{ fontSize: 11, fill: '#5d6670' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#5d6670' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#e8e1d5' }} contentStyle={{ background: '#fbfaf6', border: '1px solid #cfc7ba', borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="rmse" fill="#b87723" radius={[3, 3, 0, 0]} maxBarSize={46} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </figure>
        ) : null}

        {results.residuals.length > 0 ? (
          <figure aria-labelledby="residual-title">
            <figcaption>
              <strong id="residual-title">Residual pattern</strong>
              <span>Residual in outcome points across fitted values.</span>
            </figcaption>
            <div className="chart-frame" role="img" aria-label="Scatter plot of model residuals against predicted values">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 14, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#d8d1c5" />
                  <XAxis type="number" dataKey="predicted" name="Predicted" tick={{ fontSize: 11, fill: '#5d6670' }} axisLine={false} tickLine={false} />
                  <YAxis type="number" dataKey="residual" name="Residual" tick={{ fontSize: 11, fill: '#5d6670' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#fbfaf6', border: '1px solid #cfc7ba', borderRadius: 6, fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#26364a" strokeDasharray="4 4" />
                  <Scatter data={results.residuals} fill="#b87723" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </figure>
        ) : null}
      </div>
      <p className="causal-caution">Predictive performance describes association in held-out data. It does not establish that any input causes the outcome.</p>
    </div>
  );
}
