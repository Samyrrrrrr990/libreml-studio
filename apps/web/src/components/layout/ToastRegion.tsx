import { CheckCircle, Info, Warning, X, XCircle } from '@phosphor-icons/react';
import { useEffect } from 'react';

import { useWorkspaceStore } from '../../store/workspace';
import type { ToastMessage } from '../../types/workflow';

const ToneIcon = ({ tone }: { tone: ToastMessage['tone'] }) => {
  if (tone === 'success') return <CheckCircle size={19} weight="fill" />;
  if (tone === 'warning') return <Warning size={19} weight="fill" />;
  if (tone === 'danger') return <XCircle size={19} weight="fill" />;
  return <Info size={19} weight="fill" />;
};

function Toast({ toast }: { toast: ToastMessage }) {
  const dismiss = useWorkspaceStore((state) => state.dismissToast);
  useEffect(() => {
    const timeout = window.setTimeout(() => dismiss(toast.id), 6000);
    return () => window.clearTimeout(timeout);
  }, [dismiss, toast.id]);

  return (
    <article className={`toast toast-${toast.tone}`}>
      <ToneIcon tone={toast.tone} />
      <div><strong>{toast.title}</strong><span>{toast.message}</span></div>
      <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
        <X size={15} weight="bold" />
      </button>
    </article>
  );
}

export function ToastRegion() {
  const toasts = useWorkspaceStore((state) => state.toasts);
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} />)}
    </div>
  );
}
