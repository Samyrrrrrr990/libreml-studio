import { useEffect, useRef } from 'react';

import { useWorkspaceStore } from '../store/workspace';

/**
 * Breakpoint at which the docked side panels become overlay drawers.
 *
 * Must stay in step with the same query in `styles/responsive.css`; below it
 * the panels are positioned absolutely and stack on top of the canvas instead
 * of sitting beside it.
 */
const DRAWER_QUERY = '(max-width: 960px)';

/**
 * Keeps the side panels usable once they stop being docked.
 *
 * Both panels default to open, which is correct on a desktop three-column
 * layout. Below the drawer breakpoint that default puts two overlays on top of
 * each other and hides the canvas completely, so this does two things:
 *
 *  - collapses both panels on entering drawer mode, revealing the workflow;
 *  - treats them as mutually exclusive while narrow, so opening one closes the
 *    other rather than stacking. The most recently opened panel wins, which
 *    matches what the user just asked for.
 *
 * Nothing is forced back open on returning to a wide viewport: the panels are
 * left as the user last set them.
 */
export function useResponsivePanels(): void {
  const libraryOpen = useWorkspaceStore((state) => state.libraryOpen);
  const inspectorOpen = useWorkspaceStore((state) => state.inspectorOpen);
  const setLibraryOpen = useWorkspaceStore((state) => state.setLibraryOpen);
  const setInspectorOpen = useWorkspaceStore((state) => state.setInspectorOpen);

  const isNarrow = useRef(false);
  const previous = useRef({ libraryOpen, inspectorOpen });

  useEffect(() => {
    const media = window.matchMedia(DRAWER_QUERY);

    const sync = (matches: boolean) => {
      isNarrow.current = matches;
      if (!matches) return;
      setLibraryOpen(false);
      setInspectorOpen(false);
    };

    sync(media.matches);
    const onChange = (event: MediaQueryListEvent) => sync(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [setInspectorOpen, setLibraryOpen]);

  useEffect(() => {
    const before = previous.current;
    previous.current = { libraryOpen, inspectorOpen };
    if (!isNarrow.current || !(libraryOpen && inspectorOpen)) return;

    if (!before.libraryOpen && libraryOpen) setInspectorOpen(false);
    else if (!before.inspectorOpen && inspectorOpen) setLibraryOpen(false);
  }, [inspectorOpen, libraryOpen, setInspectorOpen, setLibraryOpen]);
}
