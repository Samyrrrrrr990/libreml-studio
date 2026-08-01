import {
  ArrowCounterClockwise,
  ArrowUUpRight,
  CaretDown,
  Info,
  Play,
  Stop,
} from '@phosphor-icons/react';
import type { RefObject } from 'react';

import { useWorkspaceStore } from '../../store/workspace';

interface TopBarProps {
  onRun: () => Promise<void>;
  onCancel: () => Promise<void>;
  aboutTriggerRef: RefObject<HTMLButtonElement | null>;
}

const formatSaveTime = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export function TopBar({ onRun, onCancel, aboutTriggerRef }: TopBarProps) {
  const project = useWorkspaceStore((state) => state.project);
  const lastSavedAt = useWorkspaceStore((state) => state.lastSavedAt);
  const run = useWorkspaceStore((state) => state.run);
  const backendOnline = useWorkspaceStore((state) => state.backendOnline);
  const pastLength = useWorkspaceStore((state) => state.past.length);
  const futureLength = useWorkspaceStore((state) => state.future.length);
  const setMode = useWorkspaceStore((state) => state.setMode);
  const updateProject = useWorkspaceStore((state) => state.updateProject);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const setAboutOpen = useWorkspaceStore((state) => state.setAboutOpen);
  const isRunning = run.status === 'running' || run.status === 'validating' || run.status === 'queued';
  const hasMeasuredProgress = run.status === 'running' && run.executionSource === 'demo';

  return (
    <header className="topbar">
      <a className="brand" href="#workspace" aria-label="LibreML Studio workspace">
        <span className="brand-mark" aria-hidden="true">L</span>
        <span className="brand-wordmark">
          <strong>LibreML</strong>
          <small>Studio</small>
        </span>
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
                onChange={(event) => updateProject({ analysisIntent: event.target.value as 'exploratory' | 'confirmatory' })}
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

      <div className="mode-switch" aria-label="Workspace mode">
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

      <div className="topbar__tools">
        <div className="history-controls" aria-label="Edit history">
          <button className="icon-button" type="button" onClick={undo} disabled={pastLength === 0} aria-label="Undo (Control or Command Z)">
            <ArrowCounterClockwise size={17} weight="bold" />
          </button>
          <button className="icon-button" type="button" onClick={redo} disabled={futureLength === 0} aria-label="Redo (Control or Command Shift Z)">
            <ArrowUUpRight size={17} weight="bold" />
          </button>
        </div>

        <div className={`engine-status status-${backendOnline === true ? 'online' : backendOnline === false ? 'demo' : 'checking'}`} title="Execution engine status">
          <span aria-hidden="true" />
          {backendOnline === true ? 'Local engine' : backendOnline === false ? 'Browser demo' : 'Checking engine'}
        </div>

        <button ref={aboutTriggerRef} className="icon-button about-button" type="button" onClick={() => setAboutOpen(true)} aria-label="About LibreML Studio">
          <Info size={18} weight="bold" />
        </button>

        {isRunning ? (
          <button className="button button-danger run-button" type="button" onClick={() => void onCancel()}>
            <Stop size={16} weight="fill" />
            Cancel
          </button>
        ) : (
          <button className="button button-primary run-button" type="button" onClick={() => void onRun()}>
            <Play size={16} weight="fill" />
            Run workflow
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
