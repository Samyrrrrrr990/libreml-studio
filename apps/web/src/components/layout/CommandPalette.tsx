import {
  ArrowCounterClockwise,
  ArrowUUpRight,
  ArrowsOutSimple,
  Flask,
  MagnifyingGlass,
  Moon,
  Play,
  Sidebar,
  SidebarSimple,
  Student,
  Sun,
  type Icon,
} from '@phosphor-icons/react';
import { useReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { NODE_CATALOG } from '../../data/catalog';
import { useWorkspaceStore, type WorkspacePanel } from '../../store/workspace';
import { NodeIcon } from '../common/NodeIcon';

interface CommandPaletteProps {
  onRun: () => Promise<void>;
}

interface Command {
  id: string;
  label: string;
  hint: string;
  group: string;
  /** Extra terms matched by the filter but never displayed. */
  keywords: string;
  icon: React.ReactNode;
  run: () => void;
}

const PANEL_LABELS: Record<WorkspacePanel, string> = {
  data: 'Data',
  integrity: 'Integrity',
  results: 'Results',
  ledger: 'Ledger',
  report: 'Report',
  predict: 'Predict',
};

const actionIcon = (IconComponent: Icon) => <IconComponent size={14} weight="bold" aria-hidden="true" />;

/**
 * Command palette.
 *
 * The workbench has a large node catalogue and a set of view actions that are
 * otherwise only reachable by pointing at the right corner of the screen. This
 * gives all of it a single keyboard entry point, which is what makes the tool
 * usable at speed once the user knows what they are doing.
 *
 * The filter matches against hidden keywords as well as labels, so searching
 * "dark", "csv", or "split" finds the right entry without the user having to
 * guess the exact wording.
 */
export function CommandPalette({ onRun }: CommandPaletteProps) {
  const { fitView } = useReactFlow();
  const open = useWorkspaceStore((state) => state.commandOpen);
  const setCommandOpen = useWorkspaceStore((state) => state.setCommandOpen);
  const addNode = useWorkspaceStore((state) => state.addNode);
  const setActivePanel = useWorkspaceStore((state) => state.setActivePanel);
  const setMode = useWorkspaceStore((state) => state.setMode);
  const setTheme = useWorkspaceStore((state) => state.setTheme);
  const setLibraryOpen = useWorkspaceStore((state) => state.setLibraryOpen);
  const setInspectorOpen = useWorkspaceStore((state) => state.setInspectorOpen);
  const loadSample = useWorkspaceStore((state) => state.loadSample);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const libraryOpen = useWorkspaceStore((state) => state.libraryOpen);
  const inspectorOpen = useWorkspaceStore((state) => state.inspectorOpen);

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const close = (action: () => void) => () => {
      action();
      setCommandOpen(false);
    };

    const nodeCommands: Command[] = NODE_CATALOG.filter((node) => node.available).map((node) => ({
      id: `add:${node.type}`,
      label: node.name,
      hint: node.category,
      group: 'Add node',
      keywords: `${node.summary} ${node.keywords.join(' ')} ${node.type}`,
      icon: <NodeIcon icon={node.icon} size={14} weight="duotone" aria-hidden="true" />,
      run: close(() => addNode(node.type)),
    }));

    const panelCommands: Command[] = (Object.keys(PANEL_LABELS) as WorkspacePanel[]).map((panel) => ({
      id: `panel:${panel}`,
      label: `Open ${PANEL_LABELS[panel]} panel`,
      hint: 'View',
      group: 'Go to',
      keywords: `panel tab ${panel}`,
      icon: actionIcon(Sidebar),
      run: close(() => setActivePanel(panel, true)),
    }));

    const actions: Command[] = [
      {
        id: 'run',
        label: 'Run workflow',
        hint: 'Cmd Enter',
        group: 'Actions',
        keywords: 'execute start all nodes',
        icon: actionIcon(Play),
        run: close(() => void onRun()),
      },
      {
        id: 'fit',
        label: 'Fit workflow to view',
        hint: 'Canvas',
        group: 'Actions',
        keywords: 'zoom center canvas fit',
        icon: actionIcon(ArrowsOutSimple),
        run: close(() => void fitView({ padding: 0.16, duration: 220 })),
      },
      {
        id: 'sample',
        label: 'Load sample project',
        hint: 'Data',
        group: 'Actions',
        keywords: 'demo example dataset bundled',
        icon: actionIcon(Flask),
        run: close(loadSample),
      },
      {
        id: 'undo',
        label: 'Undo',
        hint: 'Cmd Z',
        group: 'Actions',
        keywords: 'history back revert',
        icon: actionIcon(ArrowCounterClockwise),
        run: close(undo),
      },
      {
        id: 'redo',
        label: 'Redo',
        hint: 'Cmd Shift Z',
        group: 'Actions',
        keywords: 'history forward',
        icon: actionIcon(ArrowUUpRight),
        run: close(redo),
      },
      {
        id: 'mode:learning',
        label: 'Switch to Learning Mode',
        hint: 'Mode',
        group: 'Workspace',
        keywords: 'explain teach definitions beginner',
        icon: actionIcon(Student),
        run: close(() => setMode('learning')),
      },
      {
        id: 'mode:research',
        label: 'Switch to Research Mode',
        hint: 'Mode',
        group: 'Workspace',
        keywords: 'rigorous reproducible parameters lineage',
        icon: actionIcon(Flask),
        run: close(() => setMode('research')),
      },
      {
        id: 'theme:light',
        label: 'Use light theme',
        hint: 'Appearance',
        group: 'Workspace',
        keywords: 'bright paper day appearance',
        icon: actionIcon(Sun),
        run: close(() => setTheme('light')),
      },
      {
        id: 'theme:dark',
        label: 'Use dark theme',
        hint: 'Appearance',
        group: 'Workspace',
        keywords: 'night dim appearance',
        icon: actionIcon(Moon),
        run: close(() => setTheme('dark')),
      },
      {
        id: 'theme:system',
        label: 'Match system appearance',
        hint: 'Appearance',
        group: 'Workspace',
        keywords: 'auto os theme appearance',
        icon: actionIcon(Sun),
        run: close(() => setTheme('system')),
      },
      {
        id: 'toggle:library',
        label: libraryOpen ? 'Hide node library' : 'Show node library',
        hint: 'Layout',
        group: 'Workspace',
        keywords: 'sidebar panel nodes',
        icon: actionIcon(SidebarSimple),
        run: close(() => setLibraryOpen(!libraryOpen)),
      },
      {
        id: 'toggle:inspector',
        label: inspectorOpen ? 'Hide inspector' : 'Show inspector',
        hint: 'Layout',
        group: 'Workspace',
        keywords: 'sidebar panel configuration',
        icon: actionIcon(SidebarSimple),
        run: close(() => setInspectorOpen(!inspectorOpen)),
      },
    ];

    return [...actions, ...nodeCommands, ...panelCommands];
  }, [
    addNode,
    fitView,
    inspectorOpen,
    libraryOpen,
    loadSample,
    onRun,
    redo,
    setActivePanel,
    setCommandOpen,
    setInspectorOpen,
    setLibraryOpen,
    setMode,
    setTheme,
    undo,
  ]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.group} ${command.hint} ${command.keywords}`
        .toLowerCase()
        .includes(needle),
    );
  }, [commands, query]);

  // Reset to a known state each time the palette opens so it never reopens
  // showing a stale query or a cursor pointing past the end of the list.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Keep the cursor row inside the scroll viewport during keyboard traversal.
  useEffect(() => {
    listRef.current?.querySelector('.is-cursor')?.scrollIntoView({ block: 'nearest' });
  }, [cursor, filtered]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setCommandOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => (filtered.length === 0 ? 0 : (value + 1) % filtered.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => (filtered.length === 0 ? 0 : (value - 1 + filtered.length) % filtered.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      filtered[cursor]?.run();
    }
  };

  let renderedGroup = '';

  return (
    <div
      className="command-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setCommandOpen(false);
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
      >
        <div className="command-palette__search">
          <MagnifyingGlass size={17} weight="bold" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search nodes, actions, and views"
            aria-label="Search commands"
            aria-controls="command-results"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="command-palette__list" id="command-results" ref={listRef} role="listbox">
          {filtered.length === 0 ? (
            <p className="command-palette__empty">No command matches “{query}”.</p>
          ) : (
            filtered.map((command, index) => {
              const showGroup = command.group !== renderedGroup;
              renderedGroup = command.group;
              return (
                <div key={command.id}>
                  {showGroup ? <p className="command-palette__group">{command.group}</p> : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === cursor}
                    className={`command-item${index === cursor ? ' is-cursor' : ''}`}
                    onMouseMove={() => setCursor(index)}
                    onClick={command.run}
                    tabIndex={-1}
                  >
                    <span className="command-item__icon">{command.icon}</span>
                    <span className="command-item__copy">
                      <strong>{command.label}</strong>
                    </span>
                    <span className="command-item__hint">{command.hint}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="command-palette__footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            Navigate
          </span>
          <span>
            <kbd>↵</kbd>
            Select
          </span>
          <span>
            <kbd>Esc</kbd>
            Dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
