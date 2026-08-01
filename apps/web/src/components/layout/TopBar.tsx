import {
  ArrowCounterClockwise,
  ArrowUUpRight,
  CaretDown,
  Info,
  MagnifyingGlass,
  Monitor,
  Moon,
  Play,
  Stop,
  Sun,
} from '@phosphor-icons/react';
import type { RefObject } from 'react';

import { useWorkspaceStore, type ThemePreference } from '../../store/workspace';

interface TopBarProps {
  onRun: () => Promise<void>;
  onCancel: () => Promise<void>;
  aboutTriggerRef: RefObject<HTMLButtonElement | null>;
}

const formatSaveTime = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** Cycle order for the appearance control: system, then the two explicit modes. */
const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Appearance: matching system',
  light: 'Appearance: light',
  dark: 'Appearance: dark',
};

const ThemeIcon = ({ theme }: { theme: ThemePreference }) => {
  const props = { size: 16, weight: 'bold' as const, 'aria-hidden': true };
  if (theme === 'light') return <Sun {...props} />;
  if (theme === 'dark') return <Moon {...props} />;
  return <Monitor {...props} />;
};

export function TopBar({ onRun, onCancel, aboutTriggerRef }: TopBarProps) {
  const project = useWorkspaceStore((state) => state.project);
  const lastSavedAt = useWorkspaceStore((state) => state.lastSavedAt);
  const run = useWorkspaceStore((state) => state.run);
  const backendOnline = useWorkspaceStore((state) => state.backendOnline);
  const pastLength = useWorkspaceStore((state) => state.past.length);
  const futureLength = useWorkspaceStore((state) => state.future.length);
  const theme = useWorkspaceStore((state) => state.theme);
  const setMode = useWorkspaceStore((state) => state.setMode);
  const setTheme = useWorkspaceStore((state) => state.setTheme);
  const updateProject = useWorkspaceStore((state) => state.updateProject);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const setAboutOpen = useWorkspaceStore((state) => state.setAboutOpen);
  const setCommandOpen = useWorkspaceStore((state) => state.setCommandOpen);

  const isRunning = run.status === 'running' || run.status === 'validating' || run.status === 'queued';
  const hasMeasuredProgress = run.status === 'running' && run.executionSource === 'demo';

  const cycleTheme = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(next ?? 'system');
  };

  return (
    <header className="topbar">
      <a className="brand" href="#workspace" aria-label="LibreML Studio workspace">
        <span className="brand-mark" aria-hidden="true">
          L
        </span>
        <span className="brand-wordmark">LibreML</span>
      </a>

      <details className="project-brief">
        <summary>
          <span>
            <strong>{project.title}</strong>
            <small>{project.researchQuestion}</small>
          </span>
          <CaretDown size={13} weight="bold" aria-hidden="true" />
        </summary>
        <div className="project-brief__popover">
          <h2>Project brief</h2>
          <label className="form-field">
            <span>Project title</span>
            <input value={project.title} onChange={(event) => updateProject({ title: event.target.value })} />
          </label>
          <label className="form-field">
            <span>Research question</span>
            <textarea
              rows={3}
              value={project.researchQuestion}
              onChange={(event) => updateProject({ researchQuestion: event.target.value })}
            />
          </label>
          <div className="project-brief__row">
            <label className="form-field">
              <span>Analysis intent</span>
              <select
                value={project.analysisIntent}
                onChange={(event) =>
                  updateProject({ analysisIntent: event.target.value as 'exploratory' | 'confirmatory' })
                }
              >
                <option value="exploratory">Exploratory</option>
                <option value="confirmatory">Confirmatory</option>
              </select>
            </label>
            <label className="form-field">
              <span>Random seed</span>
              <input
                type="number"
                min={0}
                max={2_147_483_647}
                value={project.randomSeed}
                onChange={(event) => updateProject({ randomSeed: Number(event.target.value) })}
              />
            </label>
          </div>
          <p>Saved locally at {formatSaveTime(lastSavedAt)}. No account or telemetry is used.</p>
        </div>
      </details>

      <div className="topbar__tools">
        <div className="segmented" aria-label="Workspace mode">
          <button
            type="button"
            className={project.mode === 'learning' ? 'is-active' : ''}
            onClick={() => setMode('learning')}
            aria-pressed={project.mode === 'learning'}
            title="Definitions, examples, and recommended next steps"
          >
            Learning
          </button>
          <button
            type="button"
            className={project.mode === 'research' ? 'is-active' : ''}
            onClick={() => setMode('research')}
            aria-pressed={project.mode === 'research'}
            title="Parameters, assumptions, lineage, and reproducibility"
          >
            Research
          </button>
        </div>

        <span className="topbar__divider" aria-hidden="true" />

        <div className="history-controls" aria-label="Edit history">
          <button
            className="icon-button"
            type="button"
            onClick={undo}
            disabled={pastLength === 0}
            aria-label="Undo (Control or Command Z)"
            title="Undo"
          >
            <ArrowCounterClockwise size={16} weight="bold" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={redo}
            disabled={futureLength === 0}
            aria-label="Redo (Control or Command Shift Z)"
            title="Redo"
          >
            <ArrowUUpRight size={16} weight="bold" />
          </button>
        </div>

        <button
          className="icon-button"
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Open command palette (Control or Command K)"
          title="Command palette"
        >
          <MagnifyingGlass size={16} weight="bold" />
        </button>

        <button
          className="icon-button"
          type="button"
          onClick={cycleTheme}
          aria-label={THEME_LABELS[theme]}
          title={THEME_LABELS[theme]}
        >
          <ThemeIcon theme={theme} />
        </button>

        <button
          ref={aboutTriggerRef}
          className="icon-button about-button"
          type="button"
          onClick={() => setAboutOpen(true)}
          aria-label="About LibreML Studio"
          title="About"
        >
          <Info size={16} weight="bold" />
        </button>

        <span className="topbar__divider" aria-hidden="true" />

        <span
          className={`engine-status status-${
            backendOnline === true ? 'online' : backendOnline === false ? 'demo' : 'checking'
          }`}
          title="Execution engine status"
        >
          <i aria-hidden="true" />
          <span>
            {backendOnline === true
              ? 'Local engine'
              : backendOnline === false
                ? 'Browser demo'
                : 'Checking engine'}
          </span>
        </span>

        {isRunning ? (
          <button className="button button-danger run-button" type="button" onClick={() => void onCancel()}>
            <Stop size={14} weight="fill" aria-hidden="true" />
            <span>Cancel</span>
          </button>
        ) : (
          <button className="button button-primary run-button" type="button" onClick={() => void onRun()}>
            <Play size={14} weight="fill" aria-hidden="true" />
            <span>Run workflow</span>
          </button>
        )}
      </div>

      {isRunning ? (
        <div
          className={`global-progress${hasMeasuredProgress ? '' : ' is-indeterminate'}`}
          role="progressbar"
          aria-label={run.message ?? 'Workflow in progress'}
          aria-valuenow={hasMeasuredProgress ? run.progress : undefined}
          aria-valuemin={hasMeasuredProgress ? 0 : undefined}
          aria-valuemax={hasMeasuredProgress ? 100 : undefined}
        >
          <span style={hasMeasuredProgress ? { transform: `scaleX(${run.progress / 100})` } : undefined} />
        </div>
      ) : null}
    </header>
  );
}
