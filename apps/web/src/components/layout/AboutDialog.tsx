import { GithubLogo, Scales, ShieldCheck, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, type RefObject } from 'react';

import { useWorkspaceStore } from '../../store/workspace';

interface AboutDialogProps {
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function AboutDialog({ returnFocusRef }: AboutDialogProps) {
  const open = useWorkspaceStore((state) => state.aboutOpen);
  const setOpen = useWorkspaceStore((state) => state.setAboutOpen);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return undefined;

    const returnFocusTarget = returnFocusRef.current;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [close, open, returnFocusRef]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) {
        event.preventDefault();
        close();
      }
    }}>
      <section className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <header>
          <div>
            <span>Local-first research software</span>
            <h2 id="about-title">About LibreML Studio</h2>
          </div>
          <button ref={closeRef} className="icon-button" type="button" onClick={close} aria-label="Close About dialog">
            <X size={18} weight="bold" />
          </button>
        </header>
        <p>
          LibreML Studio helps researchers build inspectable machine-learning and statistical workflows. It keeps core analysis local and records consequential decisions instead of hiding them.
        </p>
        <div className="about-dialog__links">
          <a href="https://github.com/Samyrrrrrr990/libreml-studio" target="_blank" rel="noreferrer">
            <GithubLogo size={20} weight="duotone" />
            <span><strong>Source repository</strong><small>Inspect code, report issues, and contribute.</small></span>
          </a>
          <a href="https://www.gnu.org/licenses/agpl-3.0.en.html" target="_blank" rel="noreferrer">
            <Scales size={20} weight="duotone" />
            <span><strong>GNU AGPL v3</strong><small>Free software terms for the community edition.</small></span>
          </a>
          <div>
            <ShieldCheck size={20} weight="duotone" />
            <span><strong>No warranty</strong><small>Review outputs and methodology before relying on them.</small></span>
          </div>
        </div>
        <p className="about-notice">
          Copyright © 2026 LibreML contributors. This program comes with no warranty, to the extent permitted by law. Commercial licensing may be available separately.
        </p>
      </section>
    </div>
  );
}
