import {
  CheckCircle,
  CircleNotch,
  Clock,
  Hourglass,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

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
  const props = { size: 14, weight: 'bold' as const, 'aria-hidden': true };
  if (status === 'running') return <CircleNotch {...props} className="status-spin" />;
  if (status === 'success') return <CheckCircle {...props} />;
  if (status === 'warning') return <Warning {...props} />;
  if (status === 'failed') return <XCircle {...props} />;
  if (status === 'queued') return <Hourglass {...props} />;
  return <Clock {...props} />;
};

export function ResearchNode({ data, selected }: NodeProps<WorkflowNode>) {
  const rowCount = Math.max(data.inputs.length, data.outputs.length, 1);

  return (
    <article
      className={`research-node status-${data.status}${selected ? ' is-selected' : ''}`}
      aria-label={`${data.label}, ${STATUS_LABELS[data.status]}`}
    >
      <header className="research-node__header">
        <span className="research-node__icon">
          <NodeIcon icon={data.icon} size={17} weight="duotone" aria-hidden="true" />
        </span>
        <span className="research-node__heading">
          <strong>{data.label}</strong>
          <small>{data.category}</small>
        </span>
        {data.warningCount > 0 ? (
          <span className="research-node__warning" aria-label={`${data.warningCount} warning`}>
            <Warning size={14} weight="fill" aria-hidden="true" />
            {data.warningCount}
          </span>
        ) : null}
      </header>

      <div className="research-node__ports" style={{ '--port-rows': rowCount } as React.CSSProperties}>
        <div className="research-node__port-column is-input">
          {data.inputs.map((port) => (
            <div className="research-node__port" key={port.id} title={`${port.label}: ${port.type}`}>
              <Handle
                id={port.id}
                type="target"
                position={Position.Left}
                className={`typed-handle type-${port.type.toLowerCase()}`}
              />
              <span>{port.label}</span>
              <small>{port.type}</small>
            </div>
          ))}
        </div>
        <div className="research-node__port-column is-output">
          {data.outputs.map((port) => (
            <div className="research-node__port" key={port.id} title={`${port.label}: ${port.type}`}>
              <Handle
                id={port.id}
                type="source"
                position={Position.Right}
                className={`typed-handle type-${port.type.toLowerCase()}`}
              />
              <span>{port.label}</span>
              <small>{port.type}</small>
            </div>
          ))}
        </div>
      </div>

      <footer className="research-node__footer" aria-live="polite">
        <span className="node-status-label">
          <StatusIcon status={data.status} />
          {STATUS_LABELS[data.status]}
        </span>
        {data.durationMs !== undefined ? <span className="node-duration">{data.durationMs} ms</span> : null}
      </footer>
      {data.status === 'running' ? (
        <div className="node-progress is-indeterminate" role="progressbar" aria-label={`${data.label} is running`}>
          <span />
        </div>
      ) : null}
    </article>
  );
}
