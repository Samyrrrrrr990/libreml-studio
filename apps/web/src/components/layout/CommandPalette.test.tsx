import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceStore } from '../../store/workspace';
import { CommandPalette } from './CommandPalette';

const noop = async (): Promise<void> => {};

const renderPalette = () =>
  render(
    <ReactFlowProvider>
      <CommandPalette onRun={noop} />
    </ReactFlowProvider>,
  );

describe('CommandPalette', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ commandOpen: true, theme: 'system' });
  });
  afterEach(cleanup);

  it('renders nothing while closed', () => {
    useWorkspaceStore.setState({ commandOpen: false });
    renderPalette();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('focuses the search field on open so typing goes straight to the filter', () => {
    renderPalette();

    expect(screen.getByRole('textbox', { name: 'Search commands' })).toHaveFocus();
  });

  it('matches hidden keywords, not only visible labels', async () => {
    const user = userEvent.setup();
    renderPalette();

    // "reproducible" appears in the Research Mode keywords and nowhere in its label.
    await user.keyboard('reproducible');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Switch to Research Mode');
  });

  it('runs the cursor entry on Enter and closes', async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard('dark theme');
    await user.keyboard('{Enter}');

    expect(useWorkspaceStore.getState().theme).toBe('dark');
    expect(useWorkspaceStore.getState().commandOpen).toBe(false);
  });

  it('wraps the cursor around both ends of the list', async () => {
    const user = userEvent.setup();
    renderPalette();

    // Narrow to a known two-entry result set to make the wrap deterministic.
    await user.keyboard('appearance');
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);

    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option').at(-1)).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('reports an empty result rather than showing a stale list', async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard('zzzznotacommand');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(/No command matches/)).toBeInTheDocument();
  });

  it('closes on Escape without running anything', async () => {
    const user = userEvent.setup();
    const before = useWorkspaceStore.getState().theme;
    renderPalette();

    await user.keyboard('{Escape}');

    expect(useWorkspaceStore.getState().commandOpen).toBe(false);
    expect(useWorkspaceStore.getState().theme).toBe(before);
  });

  it('adds a node to the workflow when its command is chosen', async () => {
    const user = userEvent.setup();
    const addNode = vi.fn(() => 'node-1');
    useWorkspaceStore.setState({ addNode });
    renderPalette();

    await user.keyboard('CSV import');
    await user.keyboard('{Enter}');

    expect(addNode).toHaveBeenCalledWith('csv_import');
  });
});
