import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { memo, useState } from 'react';

import { portColorClass } from '../../lib/portFamily';
import type { WorkflowEdge } from '../../types/workflow';

/**
 * A typed connection between two node ports.
 *
 * The type label is shown on hover or selection rather than permanently. It is
 * rendered through React Flow's `EdgeLabelRenderer` portal, which places it
 * outside the edge's own DOM subtree, so hover cannot be resolved in CSS and is
 * tracked here instead.
 *
 * The stroke is painted twice: a wide transparent path supplies a forgiving hit
 * area (a 1.6px line is close to impossible to hit with a mouse), and the
 * visible path sits on top of it.
 */
export const ResearchEdge = memo(function ResearchEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<WorkflowEdge>) {
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.34,
  });

  const colorClass = portColorClass(data?.portType);
  const active = hovered || Boolean(selected);

  return (
    <>
      <g
        className={colorClass}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <path d={edgePath} fill="none" stroke="transparent" strokeWidth={16} />
        <path
          d={edgePath}
          fill="none"
          className={`research-edge is-typed${selected ? ' is-selected' : ''}`}
          style={active ? { stroke: 'var(--port-color)', strokeWidth: 2.4 } : undefined}
          {...(markerEnd ? { markerEnd } : {})}
        />
      </g>
      {active ? (
        <EdgeLabelRenderer>
          <span
            className={`edge-type-label is-visible nodrag nopan ${colorClass}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data?.portType}
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
