import {
  CaretDown,
  ChartBar,
  Database,
  FileText,
  Gauge,
  ListDashes,
  ShieldWarning,
} from '@phosphor-icons/react';

import { useWorkspaceStore, type WorkspacePanel } from '../../store/workspace';
import { DataPreviewPanel } from './DataPreviewPanel';
import { IntegrityPanel } from './IntegrityPanel';
import { LedgerPanel } from './LedgerPanel';
import { PredictionPanel } from './PredictionPanel';
import { ReportPanel } from './ReportPanel';
import { ResultsPanel } from './ResultsPanel';

interface BottomPanelProps {
  onRun: () => Promise<void>;
}

const tabs: Array<{ id: WorkspacePanel; label: string; icon: typeof Database }> = [
  { id: 'data', label: 'Data', icon: Database },
  { id: 'integrity', label: 'Integrity', icon: ShieldWarning },
  { id: 'results', label: 'Results', icon: ChartBar },
  { id: 'ledger', label: 'Ledger', icon: ListDashes },
  { id: 'report', label: 'Report', icon: FileText },
  { id: 'predict', label: 'Predict', icon: Gauge },
];

export function BottomPanel({ onRun }: BottomPanelProps) {
  const activePanel = useWorkspaceStore((state) => state.activePanel);
  const open = useWorkspaceStore((state) => state.bottomPanelOpen);
  const warningCount = useWorkspaceStore((state) => state.warnings.filter((warning) => warning.decision === 'pending').length);
  const hasResults = useWorkspaceStore((state) => state.results !== null);
  const setActivePanel = useWorkspaceStore((state) => state.setActivePanel);
  const setOpen = useWorkspaceStore((state) => state.setBottomPanelOpen);

  const panel =
    activePanel === 'data' ? <DataPreviewPanel />
      : activePanel === 'integrity' ? <IntegrityPanel />
        : activePanel === 'results' ? <ResultsPanel onRun={onRun} />
          : activePanel === 'ledger' ? <LedgerPanel />
            : activePanel === 'report' ? <ReportPanel />
              : <PredictionPanel />;

  return (
    <section className={`bottom-panel${open ? ' is-open' : ''}`} aria-label="Research artifacts">
      <div className="bottom-panel__tabs" role="tablist" aria-label="Research artifacts">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = tab.id === 'integrity' && warningCount > 0 ? warningCount : tab.id === 'results' && hasResults ? 1 : null;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={open && activePanel === tab.id}
              className={open && activePanel === tab.id ? 'is-active' : ''}
              onClick={() => setActivePanel(tab.id, true)}
            >
              <Icon size={16} weight={activePanel === tab.id ? 'fill' : 'bold'} />
              <span>{tab.label}</span>
              {count ? <small aria-label={`${count} items`}>{count}</small> : null}
            </button>
          );
        })}
        <button className="panel-collapse" type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse research artifacts' : 'Expand research artifacts'}>
          <CaretDown size={16} weight="bold" className={open ? '' : 'rotate-180'} />
        </button>
      </div>
      {open ? <div className="bottom-panel__content" role="tabpanel">{panel}</div> : null}
    </section>
  );
}
