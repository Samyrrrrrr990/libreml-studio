import { ArrowsOutSimple, SidebarSimple } from '@phosphor-icons/react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
} from '@xyflow/react';
import { useCallback, useMemo, type DragEvent } from 'react';

import { NODE_BY_TYPE } from '../../data/catalog';
import { makeWorkflowEdge, validateTypedConnection } from '../../lib/graph';
import { useWorkspaceStore } from '../../store/workspace';
import { ResearchEdge } from './ResearchEdge';
import { ResearchNode } from './ResearchNode';

const nodeTypes = { researchNode: ResearchNode };
const edgeTypes = { researchEdge: ResearchEdge };

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

  const displayNodes = useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [nodes, selectedNodeId],
  );

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
    <section className="canvas-region" aria-label="Workflow canvas">
      <div className="canvas-titlebar">
        <button
          className="icon-button canvas-drawer-button library-trigger"
          type="button"
          onClick={() => setLibraryOpen(!libraryOpen)}
          aria-label={libraryOpen ? 'Hide node library' : 'Show node library'}
          aria-pressed={libraryOpen}
        >
          <SidebarSimple size={18} weight="bold" />
        </button>
        <div>
          <strong>Workflow</strong>
          <span>{nodes.length} nodes, {edges.length} typed connections</span>
        </div>
        <div className="canvas-titlebar__actions">
          <button className="icon-button" type="button" onClick={() => void fitView({ padding: 0.14 })} aria-label="Fit workflow to view">
            <ArrowsOutSimple size={17} weight="bold" />
          </button>
          <button
            className="icon-button canvas-drawer-button inspector-trigger"
            type="button"
            onClick={() => setInspectorOpen(!inspectorOpen)}
            aria-label={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
            aria-pressed={inspectorOpen}
          >
            <SidebarSimple size={18} weight="bold" className="flip-horizontal" />
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
        fitViewOptions={{ padding: 0.14, maxZoom: 0.9 }}
        minZoom={0.25}
        maxZoom={1.5}
        snapToGrid
        snapGrid={[14, 14]}
        deleteKeyCode={null}
        connectionLineStyle={{ stroke: '#b87723', strokeWidth: 2 }}
        defaultEdgeOptions={{ type: 'researchEdge' }}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#c8c1b2" gap={28} size={1.25} variant={BackgroundVariant.Dots} />
        <MiniMap
          className="workflow-minimap"
          pannable
          zoomable
          nodeColor={(node) => (node.selected ? '#b87723' : '#26364a')}
          maskColor="rgba(241, 238, 230, 0.76)"
        />
        <Controls className="workflow-controls" showInteractive={false} />
      </ReactFlow>
      <div className="canvas-privacy-note">Local canvas. Dataset rows never enter browser storage unless you import them.</div>
    </section>
  );
}
