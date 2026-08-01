import { ArrowsOutSimple, HardDrives, SidebarSimple } from '@phosphor-icons/react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
  type Connection,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react';

import { NODE_BY_TYPE } from '../../data/catalog';
import { makeWorkflowEdge, validateTypedConnection } from '../../lib/graph';
import { PORT_FAMILY_LABELS } from '../../lib/portFamily';
import { useWorkspaceStore } from '../../store/workspace';
import { ResearchEdge } from './ResearchEdge';
import { ResearchNode } from './ResearchNode';

const nodeTypes = { researchNode: ResearchNode };
const edgeTypes = { researchEdge: ResearchEdge };

/**
 * Zoom thresholds at which node cards drop or regain detail.
 *
 * Derived from rendered text size, not round numbers. Port labels are 11px, so
 * they fall below a readable 8px once zoom drops under about 0.7. Type captions
 * are 8px and only earn their space above 1.1.
 *
 * A whole-pipeline fit on a laptop lands near 0.5, so the far band is the view
 * users actually open into. It is treated as a first-class state with a title
 * scaled up to survive the reduction, rather than as a degraded one.
 */
const ZOOM_MID = 0.7;
const ZOOM_NEAR = 1.1;

type ZoomBand = 'far' | 'mid' | 'near';

const bandForZoom = (zoom: number): ZoomBand =>
  zoom < ZOOM_MID ? 'far' : zoom < ZOOM_NEAR ? 'mid' : 'near';

export function WorkflowCanvas() {
  const nodes = useWorkspaceStore((state) => state.nodes);
  const edges = useWorkspaceStore((state) => state.edges);
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId);
  const libraryOpen = useWorkspaceStore((state) => state.libraryOpen);
  const inspectorOpen = useWorkspaceStore((state) => state.inspectorOpen);
  const applyNodeChanges = useWorkspaceStore((state) => state.applyNodeChanges);
  const applyEdgeChanges = useWorkspaceStore((state) => state.applyEdgeChanges);
  const setSelectedNode = useWorkspaceStore((state) => state.setSelectedNode);
  const checkpointGraph = useWorkspaceStore((state) => state.checkpointGraph);
  const addNode = useWorkspaceStore((state) => state.addNode);
  const addEdge = useWorkspaceStore((state) => state.addEdge);
  const notify = useWorkspaceStore((state) => state.notify);
  const setLibraryOpen = useWorkspaceStore((state) => state.setLibraryOpen);
  const setInspectorOpen = useWorkspaceStore((state) => state.setInspectorOpen);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  // Selecting the band rather than the raw zoom means this subscription fires
  // at most twice across a full zoom sweep instead of on every wheel event.
  const zoomBand = useStore((state) => bandForZoom(state.transform[2]));

  const displayNodes = useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [nodes, selectedNodeId],
  );

  /*
   * Re-measure handles whenever the level of detail changes.
   *
   * Crossing a zoom band changes port row height, which moves every handle
   * inside the card. React Flow caches handle offsets when a node mounts, so
   * without this the edges stay pinned to the previous layout's coordinates.
   */
  useEffect(() => {
    updateNodeInternals(nodes.map((node) => node.id));
  }, [zoomBand, nodes, updateNodeInternals]);

  /*
   * Fit once the canvas actually has dimensions.
   *
   * React Flow's `fitView` prop runs on init, which can happen while the
   * element is still zero-width: on narrow viewports the side panels collapse
   * in an effect after mount, and the first layout pass measures the canvas at
   * 0. Fitting against that produces a viewport pinned at minimum zoom with the
   * workflow off-screen. This retries the fit the first time a real width is
   * observed, then disconnects so it can never fight a user's own pan or zoom.
   */
  const regionRef = useRef<HTMLElement>(null);
  const hasFitted = useRef(false);

  useEffect(() => {
    const element = regionRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (hasFitted.current || width < 1) return;
      hasFitted.current = true;
      void fitView({ padding: 0.16 });
      observer.disconnect();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [fitView]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const verdict = validateTypedConnection(connection, nodes, edges);
      if (!verdict.valid || !verdict.portType) {
        notify({
          tone: 'danger',
          title: 'Connection rejected',
          message: verdict.reason ?? 'These ports are not compatible.',
        });
        return;
      }
      addEdge(makeWorkflowEdge(connection, verdict.portType));
    },
    [addEdge, edges, nodes, notify],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/libreml-node');
      if (!NODE_BY_TYPE.get(nodeType)?.available) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(nodeType, position);
    },
    [addNode, screenToFlowPosition],
  );

  return (
    <section
      className="canvas-region"
      aria-label="Workflow canvas"
      data-zoom={zoomBand}
      ref={regionRef}
    >
      <div className="canvas-titlebar">
        <button
          className="icon-button canvas-drawer-button library-trigger"
          type="button"
          onClick={() => setLibraryOpen(!libraryOpen)}
          aria-label={libraryOpen ? 'Hide node library' : 'Show node library'}
          aria-pressed={libraryOpen}
        >
          <SidebarSimple size={17} weight="bold" />
        </button>
        <div className="canvas-titlebar__meta">
          <strong>Workflow</strong>
          <span>
            {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}, {edges.length} typed{' '}
            {edges.length === 1 ? 'connection' : 'connections'}
          </span>
        </div>
        <div className="canvas-titlebar__actions">
          <span
            className="badge"
            title="Dataset rows stay on this machine. Nothing is uploaded without an explicit action."
          >
            <HardDrives size={11} weight="bold" aria-hidden="true" />
            Local only
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={() => void fitView({ padding: 0.16, duration: 220 })}
            aria-label="Fit workflow to view"
          >
            <ArrowsOutSimple size={16} weight="bold" />
          </button>
          <button
            className="icon-button canvas-drawer-button inspector-trigger"
            type="button"
            onClick={() => setInspectorOpen(!inspectorOpen)}
            aria-label={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
            aria-pressed={inspectorOpen}
          >
            <SidebarSimple size={17} weight="bold" className="flip-horizontal" />
          </button>
        </div>
      </div>
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={applyNodeChanges}
        onEdgesChange={applyEdgeChanges}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onPaneClick={() => setSelectedNode(null)}
        onNodeDragStart={checkpointGraph}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.75}
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={null}
        connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 2 }}
        defaultEdgeOptions={{ type: 'researchEdge' }}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          color="var(--canvas-dot)"
          gap={24}
          size={1.5}
          variant={BackgroundVariant.Dots}
        />
        <MiniMap
          className="workflow-minimap"
          pannable
          zoomable
          nodeColor={(node) => (node.selected ? 'var(--accent)' : 'var(--ink-soft)')}
          nodeStrokeWidth={0}
          maskColor="color-mix(in srgb, var(--bg-canvas) 62%, transparent)"
        />
        <Controls className="workflow-controls" showInteractive={false} />
      </ReactFlow>
      <div className="canvas-legend" aria-hidden="true">
        {(Object.keys(PORT_FAMILY_LABELS) as Array<keyof typeof PORT_FAMILY_LABELS>).map((family) => (
          <span key={family} style={{ '--legend-color': `var(--port-${family})` } as React.CSSProperties}>
            <i />
            {PORT_FAMILY_LABELS[family]}
          </span>
        ))}
      </div>
    </section>
  );
}
