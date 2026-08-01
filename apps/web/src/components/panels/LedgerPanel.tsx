import { DownloadSimple, ListDashes } from '@phosphor-icons/react';

import { useWorkspaceStore } from '../../store/workspace';

const formatTimestamp = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));

export function LedgerPanel() {
  const audit = useWorkspaceStore((state) => state.audit);
  const project = useWorkspaceStore((state) => state.project);
  const notify = useWorkspaceStore((state) => state.notify);

  const exportLedger = () => {
    const content = JSON.stringify({ schema_version: '1.0', project_id: project.id, events: audit }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'libreml-methodological-ledger.json';
    anchor.click();
    URL.revokeObjectURL(url);
    notify({ tone: 'success', title: 'Ledger exported', message: 'A machine-readable audit file was saved locally.' });
  };

  return (
    <div className="ledger-panel">
      <header className="ledger-heading">
        <div>
          <ListDashes size={20} weight="duotone" />
          <span><strong>Methodological ledger</strong><small>{audit.length} chronological events</small></span>
        </div>
        <button className="button button-quiet button-compact" type="button" onClick={exportLedger}>
          <DownloadSimple size={15} weight="bold" />
          Export JSON
        </button>
      </header>
      <ol className="ledger-list">
        {[...audit].reverse().map((event) => (
          <li key={event.id}>
            <div className="ledger-time"><time dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time><span>{event.actor}</span></div>
            <div className="ledger-event">
              <span>{event.kind}</span>
              <strong>{event.title}</strong>
              <p>{event.narrative}</p>
              {event.metadata ? (
                <details><summary>Structured fields</summary><pre>{JSON.stringify(event.metadata, null, 2)}</pre></details>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
