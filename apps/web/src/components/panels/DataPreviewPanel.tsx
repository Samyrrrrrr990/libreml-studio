import { Database, HardDrives, Table } from '@phosphor-icons/react';

import { useWorkspaceStore } from '../../store/workspace';

export function DataPreviewPanel() {
  const dataset = useWorkspaceStore((state) => state.dataset);
  if (!dataset) {
    return (
      <div className="panel-empty-state">
        <Database size={28} weight="duotone" />
        <strong>No dataset loaded</strong>
        <span>Choose a local CSV or load the bundled research example from the node library.</span>
      </div>
    );
  }

  const visibleColumns = dataset.columns.slice(0, 10);
  return (
    <div className="data-preview-panel">
      <header className="artifact-heading">
        <div>
          <span className="artifact-heading__icon"><Table size={18} weight="duotone" /></span>
          <div>
            <h3>{dataset.name}</h3>
            <p>{dataset.rowCount.toLocaleString()} rows, {dataset.columnCount} columns</p>
          </div>
        </div>
        <dl className="artifact-meta">
          <div><dt>Source</dt><dd>{dataset.source === 'bundled-sample' ? 'Bundled sample' : dataset.source === 'local-upload' ? 'Local upload' : 'Local API'}</dd></div>
          <div><dt>Preview</dt><dd>{dataset.sampled ? `${dataset.rows.length} sampled rows` : 'All rows'}</dd></div>
          <div><dt>Fingerprint</dt><dd><code>{dataset.fingerprint}</code></dd></div>
        </dl>
      </header>

      {dataset.source === 'bundled-sample' ? (
        <div className="demo-notice">
          <HardDrives size={17} weight="duotone" />
          <span><strong>Bundled demonstration data.</strong> Values are synthetic and must not be reported as empirical findings.</span>
        </div>
      ) : null}

      <div className="data-table-wrap" tabIndex={0} aria-label={`Preview of ${dataset.name}`}>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="row-index">Row</th>
              {visibleColumns.map((column) => (
                <th scope="col" key={column.name}>
                  <span>{column.name}</span>
                  <small>{column.type}{column.missing ? `, ${column.missing} missing` : ''}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.slice(0, 12).map((row, rowIndex) => (
              <tr key={`row-${rowIndex + 1}`}>
                <th scope="row" className="row-index">{rowIndex + 1}</th>
                {visibleColumns.map((column) => {
                  const value = row[column.name];
                  return <td key={column.name}>{value === null || value === '' ? <span className="missing-value">missing</span> : String(value)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
