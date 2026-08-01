import { CheckCircle, ShieldCheck, Warning, XCircle } from '@phosphor-icons/react';
import { useState } from 'react';

import { libreMlApi } from '../../lib/api';
import { fromApiGraph } from '../../lib/graph';
import { useWorkspaceStore } from '../../store/workspace';
import type { IntegrityWarning } from '../../types/workflow';

export function IntegrityPanel() {
  const warnings = useWorkspaceStore((state) => state.warnings);
  const mode = useWorkspaceStore((state) => state.project.mode);
  const projectId = useWorkspaceStore((state) => state.project.id);
  const backendOnline = useWorkspaceStore((state) => state.backendOnline);
  const approveRepair = useWorkspaceStore((state) => state.approveRepair);
  const rejectRepair = useWorkspaceStore((state) => state.rejectRepair);
  const notify = useWorkspaceStore((state) => state.notify);
  const replaceGraphFromServer = useWorkspaceStore((state) => state.replaceGraphFromServer);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const applyRepair = async (warning: IntegrityWarning): Promise<void> => {
    if (backendOnline && warning.source === 'backend' && warning.repairPatch) {
      setApplyingId(warning.id);
      try {
        const response = await libreMlApi.applyRepair(projectId, {
          warning_code: warning.ruleId,
          node_id: warning.affectedNodeIds[0] ?? '',
          decision: 'approve',
          repair_patch: warning.repairPatch,
        });
        const graph = fromApiGraph(response.workflow, response.stale_node_ids);
        if (!graph) throw new Error('The local engine returned a repair workflow that could not be read.');
        replaceGraphFromServer(graph.nodes, graph.edges);
      } catch (error) {
        notify({
          tone: 'danger',
          title: 'Repair was not applied',
          message: error instanceof Error ? error.message : 'The local engine rejected the repair request.',
        });
        setApplyingId(null);
        return;
      }
      setApplyingId(null);
    }
    approveRepair(warning.id);
  };

  const keepCurrentMethod = async (warning: IntegrityWarning): Promise<void> => {
    if (backendOnline && warning.source === 'backend') {
      setApplyingId(warning.id);
      try {
        const response = await libreMlApi.applyRepair(projectId, {
          warning_code: warning.ruleId,
          node_id: warning.affectedNodeIds[0] ?? '',
          decision: 'reject',
          ...(warning.repairPatch ? { repair_patch: warning.repairPatch } : {}),
        });
        const graph = fromApiGraph(response.workflow, response.stale_node_ids);
        if (!graph) throw new Error('The local engine returned a workflow that could not be read.');
        replaceGraphFromServer(graph.nodes, graph.edges);
      } catch (error) {
        notify({
          tone: 'danger',
          title: 'Decision was not recorded',
          message: error instanceof Error ? error.message : 'The local engine rejected the decision request.',
        });
        setApplyingId(null);
        return;
      }
      setApplyingId(null);
    }
    rejectRepair(warning.id);
  };

  if (warnings.length === 0) {
    return (
      <div className="panel-empty-state is-success">
        <ShieldCheck size={30} weight="duotone" />
        <strong>No integrity issues detected</strong>
        <span>Validation should be rerun whenever data, roles, split strategy, or model configuration changes.</span>
      </div>
    );
  }

  return (
    <div className="integrity-list">
      {warnings.map((warning) => (
        <article className={`integrity-issue severity-${warning.severity} decision-${warning.decision}`} key={warning.id}>
          <header>
            <span className="integrity-issue__icon"><Warning size={20} weight="fill" /></span>
            <div>
              <span>{warning.severity}</span>
              <h3>{warning.title}</h3>
              <p>{warning.plainExplanation}</p>
            </div>
            <span className="decision-status">
              {warning.decision === 'approved' ? <CheckCircle size={16} weight="fill" /> : warning.decision === 'rejected' ? <XCircle size={16} weight="fill" /> : null}
              {warning.decision === 'pending' ? 'Needs decision' : warning.decision}
            </span>
          </header>

          <div className="integrity-evidence">
            <div><span>Evidence</span><p>{warning.evidence}</p></div>
            <div><span>Likely consequence</span><p>{warning.consequence}</p></div>
          </div>

          {mode === 'research' ? (
            <details className="technical-detail">
              <summary>Technical explanation</summary>
              <p>{warning.technicalExplanation}</p>
            </details>
          ) : (
            <div className="learning-explanation">
              <strong>In everyday terms</strong>
              <p>{warning.plainExplanation}</p>
            </div>
          )}

          <div className="repair-proposal">
            <div>
              <span>Proposed repair</span>
              <strong>{warning.proposedRepair}</strong>
              <p>{warning.repairEffect}</p>
            </div>
            {warning.decision === 'pending' ? (
              <div className="repair-actions">
                <button className="button button-primary" type="button" onClick={() => void applyRepair(warning)} disabled={!warning.canAutoRepair || applyingId === warning.id}>
                  {applyingId === warning.id ? 'Applying…' : 'Review and apply'}
                </button>
                <button className="button button-quiet" type="button" onClick={() => void keepCurrentMethod(warning)} disabled={applyingId === warning.id}>
                  Keep current method
                </button>
              </div>
            ) : (
              <p className="repair-decision-copy">
                {warning.decision === 'approved'
                  ? 'Repair applied and recorded. Affected downstream nodes now need to run again.'
                  : 'Configuration retained. This unresolved warning will remain in the report.'}
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
