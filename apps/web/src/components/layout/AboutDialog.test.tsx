import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useWorkspaceStore } from '../../store/workspace';
import { AboutDialog } from './AboutDialog';

function DialogHarness() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const setOpen = useWorkspaceStore((state) => state.setAboutOpen);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>About LibreML Studio</button>
      <AboutDialog returnFocusRef={triggerRef} />
    </>
  );
}

const openDialog = async () => {
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: 'About LibreML Studio' });
  await user.click(trigger);
  expect(screen.getByRole('button', { name: 'Close About dialog' })).toHaveFocus();
  return { trigger, user };
};

describe('About dialog focus management', () => {
  beforeEach(() => useWorkspaceStore.setState({ aboutOpen: false }));
  afterEach(cleanup);

  it('returns focus to its trigger after Escape', async () => {
    render(<DialogHarness />);
    const { trigger, user } = await openDialog();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('returns focus to its trigger after the close button', async () => {
    render(<DialogHarness />);
    const { trigger, user } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Close About dialog' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('returns focus to its trigger after a backdrop click', async () => {
    render(<DialogHarness />);
    const { trigger, user } = await openDialog();
    const backdrop = screen.getByRole('dialog').parentElement;
    if (!backdrop) throw new Error('Dialog backdrop missing');

    await user.click(backdrop);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
