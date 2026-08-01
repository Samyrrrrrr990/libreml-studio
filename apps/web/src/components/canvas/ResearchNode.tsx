import {
  CheckCircle,
  CircleNotch,
  Clock,
  Hourglass,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { portColorClass } from '../../lib/portFamily';
import type { NodeStatus, WorkflowNode } from '../../types/workflow';
import { NodeIcon } from '../common/NodeIcon';

const STATUS_LABELS: Record<NodeStatus, string> = {
  idle: 'Not run',
  queued: 'Queued',
  running: 'Running',
  success: 'Complete',
  warning: 'Complete with warning',
  failed: 'Failed',
  stale: 'Needs rerun',
};

const StatusIcon = ({ status }: { status: NodeStatus }) => {
  const props = { size: 13, weight: 'bold' as const, 'aria-hidden': true };
  if (status === 'running') return <CircleNotch {...props} className="status-spin" />;
  if (status === 'success') return <CheckCircle {...props} />;
  if (status === 'warning') return <Warning {...props} />;
  if (status === 'failed') return <XCircle {...props} />;
  if (status === 'queued') return <Hourglass {...props} />;
  return <Clock {...props} />;
};

/**
 * A node on the workflow canvas.
 *
 * Memoised because React Flow re-renders the node layer on every viewport
 * change; without it, panning a large workflow re-renders every card in it.
 */
export const ResearchNode = memo(function ResearchNode({ data, selected }: NodeProps<WorkflowNode>) {
  // The footer earns its row only when it has something to report. An unrun
  // node announcing "Not run" is the least informative line on the canvas.
  const showFooter =
    data.durationMs !== undefined || data.status === 'failed' || data.status === 'stale';

  return (
    <article
      className={`research-node status-${data.status}${selected ? ' is-selected' : ''}`}
      aria-label={`${data.label}, ${STATUS_LABELS[data.status]}`}
    >
      <header className="research-node__header">
        <span className="research-node__icon">
          <NodeIcon icon={data.icon} size={15} weight="duotone" aria-hidden="true" />
        </span>
        <span className="research-node__heading">
          <strong>{data.label}</strong>
          <small>{data.category}</small>
        </span>
        {data.warningCount > 0 ? (
          <span
            className="research-node__warning"
            title={`${data.warningCount} unresolved methodological warning`}
            aria-label={`${data.warningCount} warning`}
          >
            <Warning size={11} weight="fill" aria-hidden="true" />
            {data.warningCount}
          </span>
        ) : (
          <span className="research-node__status" title={STATUS_LABELS[data.status]}>
            <StatusIcon status={data.status} />
          </span>
        )}
      </header>

      <div className="research-node__ports">
        <div className="research-node__port-column is-input">
          {data.inputs.map((port) => (
            <div
              className="research-node__port"
              key={port.id}
              title={`${port.label} - accepts ${port.type}`}
            >
              <Handle
                id={port.id}
                type="target"
                position={Position.Left}
                className={`typed-handle ${portColorClass(port.type)}`}
              />
              <span>{port.label}</span>
              <small>{port.type}</small>
            </div>
          ))}
        </div>
        <div className="research-node__port-column is-output">
          {data.outputs.map((port) => (
            <div
              className="research-node__port"
              key={port.id}
              title={`${port.label} - emits ${port.type}`}
            >
              <Handle
                id={port.id}
                type="source"
                position={Position.Right}
                className={`typed-handle ${portColorClass(port.type)}`}
              />
              <span>{port.label}</span>
              <small>{port.type}</small>
            </div>
          ))}
        </div>
      </div>

      {showFooter ? (
        <footer className="research-node__footer" aria-live="polite">
          <span>{STATUS_LABELS[data.status]}</span>
          {data.durationMs !== undefined ? (
            <span className="node-duration">{data.durationMs} ms</span>
          ) : null}
        </footer>
      ) : null}

      {data.status === 'running' ? (
        <div className="node-progress is-indeterminate" role="progressbar" aria-label={`${data.label} is running`}>
          <span />
        </div>
      ) : null}
    </article>
  );
});
