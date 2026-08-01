import { applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from '@xyflow/react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { NODE_BY_TYPE } from '../data/catalog';
import {
  INITIAL_AUDIT_EVENTS,
  SAMPLE_DATASET,
  SAMPLE_WARNING,
} from '../data/sample';
import {
  createDemoGraph,
  createWorkflowNode,
  getDownstreamNodeIds,
  hydrateNodeData,
} from '../lib/graph';
import type {
  AuditEvent,
  DatasetPreview,
  EvaluationResults,
  GraphSnapshot,
  IntegrityWarning,
  NodeStatus,
  ProjectMetadata,
  RunState,
  ToastMessage,
  WorkflowEdge,
  WorkflowNode,
  WorkspaceMode,
} from '../types/workflow';

export type WorkspacePanel = 'data' | 'integrity' | 'results' | 'ledger' | 'report' | 'predict';

const now = (): string => new Date().toISOString();
const makeId = (prefix: string): string => `${prefix}-${crypto.randomUUID().slice(0, 10)}`;
const cloneSnapshot = (nodes: WorkflowNode[], edges: WorkflowEdge[]): GraphSnapshot =>
  structuredClone({ nodes, edges });

const demo = createDemoGraph();

const INITIAL_PROJECT: ProjectMetadata = {
  id: 'local-community-outcomes',
  title: 'Community outcomes study',
  researchQuestion: 'Which baseline factors predict program completion?',
  mode: 'research',
  createdAt: now(),
  updatedAt: now(),
  randomSeed: 17,
  analysisIntent: 'exploratory',
};

const INITIAL_RUN: RunState = { status: 'idle', progress: 0 };

interface WorkspaceState {
  project: ProjectMetadata;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  dataset: DatasetPreview | null;
  warnings: IntegrityWarning[];
  results: EvaluationResults | null;
  audit: AuditEvent[];
  run: RunState;
  activePanel: WorkspacePanel;
  bottomPanelOpen: boolean;
  libraryOpen: boolean;
  inspectorOpen: boolean;
  aboutOpen: boolean;
  advancedOpen: boolean;
  backendOnline: boolean | null;
  demoExecutionEnabled: boolean;
  lastSavedAt: string;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  toasts: ToastMessage[];

  setMode: (mode: WorkspaceMode) => void;
  setProjectId: (id: string) => void;
  updateProject: (patch: Partial<Pick<ProjectMetadata, 'title' | 'researchQuestion' | 'analysisIntent' | 'randomSeed'>>) => void;
  setBackendOnline: (online: boolean) => void;
  setSelectedNode: (nodeId: string | null) => void;
  checkpointGraph: () => void;
  applyNodeChanges: (changes: NodeChange<WorkflowNode>[]) => void;
  applyEdgeChanges: (changes: EdgeChange<WorkflowEdge>[]) => void;
  addNode: (nodeType: string, position?: { x: number; y: number }) => string | null;
  addEdge: (edge: WorkflowEdge) => void;
  removeSelectedNode: () => void;
  duplicateSelectedNode: () => void;
  updateNodeConfig: (nodeId: string, key: string, value: string | number | boolean) => void;
  setNodeStatus: (nodeId: string, status: NodeStatus, progress?: number, durationMs?: number) => void;
  markAllNodes: (status: NodeStatus) => void;
  undo: () => void;
  redo: () => void;
  loadSample: () => void;
  setDataset: (dataset: DatasetPreview) => void;
  approveRepair: (warningId: string) => void;
  rejectRepair: (warningId: string) => void;
  setResults: (results: EvaluationResults | null) => void;
  setWarnings: (warnings: IntegrityWarning[]) => void;
  replaceGraphFromServer: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  setRun: (run: RunState) => void;
  appendAudit: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => void;
  setActivePanel: (panel: WorkspacePanel, open?: boolean) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setLibraryOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setAdvancedOpen: (open: boolean) => void;
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const graphCheckpoint = (state: WorkspaceState): Pick<WorkspaceState, 'past' | 'future'> => ({
  past: [...state.past.slice(-39), cloneSnapshot(state.nodes, state.edges)],
  future: [],
});

const touchProject = (project: ProjectMetadata): ProjectMetadata => ({ ...project, updatedAt: now() });

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      project: INITIAL_PROJECT,
      nodes: demo.nodes,
      edges: demo.edges,
      selectedNodeId: 'assign-roles',
      dataset: SAMPLE_DATASET,
      warnings: [SAMPLE_WARNING],
      results: null,
      audit: INITIAL_AUDIT_EVENTS,
      run: INITIAL_RUN,
      activePanel: 'integrity',
      bottomPanelOpen: true,
      libraryOpen: true,
      inspectorOpen: true,
      aboutOpen: false,
      advancedOpen: false,
      backendOnline: null,
      demoExecutionEnabled: false,
      lastSavedAt: now(),
      past: [],
      future: [],
      toasts: [],

      setMode: (mode) =>
        set((state) => ({
          project: touchProject({ ...state.project, mode }),
          lastSavedAt: now(),
          audit: [
            ...state.audit,
            {
              id: makeId('audit'),
              timestamp: now(),
              kind: 'project',
              title: `${mode === 'learning' ? 'Learning' : 'Research'} Mode selected`,
              narrative:
                mode === 'learning'
                  ? 'Guidance now emphasizes definitions, examples, and recommended next steps. The workflow itself is unchanged.'
                  : 'Guidance now emphasizes parameters, assumptions, lineage, and reproducibility. The workflow itself is unchanged.',
              actor: 'user',
            },
          ],
        })),

      setProjectId: (id) =>
        set((state) => ({
          project: touchProject({ ...state.project, id }),
          lastSavedAt: now(),
        })),

      updateProject: (patch) =>
        set((state) => ({
          project: touchProject({ ...state.project, ...patch }),
          lastSavedAt: now(),
        })),

      setBackendOnline: (backendOnline) => set({ backendOnline }),

      setSelectedNode: (selectedNodeId) => set({ selectedNodeId, inspectorOpen: selectedNodeId !== null }),

      checkpointGraph: () => set((state) => graphCheckpoint(state)),

      applyNodeChanges: (changes) =>
        set((state) => {
          const destructive = changes.some((change) => change.type === 'remove');
          return {
            ...(destructive ? graphCheckpoint(state) : {}),
            nodes: applyNodeChanges(changes, state.nodes),
            ...(destructive ? { results: null } : {}),
            project: touchProject(state.project),
            lastSavedAt: now(),
          };
        }),

      applyEdgeChanges: (changes) =>
        set((state) => {
          const structural = changes.some((change) => change.type === 'remove');
          return {
            ...(structural ? graphCheckpoint(state) : {}),
            edges: applyEdgeChanges(changes, state.edges),
            ...(structural ? { results: null } : {}),
            project: touchProject(state.project),
            lastSavedAt: now(),
          };
        }),

      addNode: (nodeType, position = { x: 360, y: 240 }) => {
        const spec = NODE_BY_TYPE.get(nodeType);
        if (!spec || !spec.available) return null;
        const node = createWorkflowNode(spec, position);
        set((state) => ({
          ...graphCheckpoint(state),
          nodes: [...state.nodes, node],
          results: null,
          selectedNodeId: node.id,
          inspectorOpen: true,
          project: touchProject(state.project),
          lastSavedAt: now(),
          audit: [
            ...state.audit,
            {
              id: makeId('audit'),
              timestamp: now(),
              kind: 'graph',
              title: `${spec.name} added`,
              narrative: `${spec.name} was added to the workflow canvas. It has not run yet.`,
              actor: 'user',
              metadata: { node_id: node.id, node_type: spec.type },
            },
          ],
        }));
        return node.id;
      },

      addEdge: (edge) =>
        set((state) => ({
          ...graphCheckpoint(state),
          edges: [...state.edges, edge],
          results: null,
          project: touchProject(state.project),
          lastSavedAt: now(),
          audit: [
            ...state.audit,
            {
              id: makeId('audit'),
              timestamp: now(),
              kind: 'graph',
              title: 'Nodes connected',
              narrative: `A typed ${edge.data?.portType ?? 'workflow'} connection was added.`,
              actor: 'user',
            },
          ],
        })),

      removeSelectedNode: () => {
        const selectedNodeId = get().selectedNodeId;
        if (!selectedNodeId) return;
        set((state) => ({
          ...graphCheckpoint(state),
          nodes: state.nodes.filter((node) => node.id !== selectedNodeId),
          edges: state.edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
          selectedNodeId: null,
          results: null,
          project: touchProject(state.project),
          lastSavedAt: now(),
        }));
      },

      duplicateSelectedNode: () => {
        const selected = get().nodes.find((node) => node.id === get().selectedNodeId);
        if (!selected) return;
        const copyData = structuredClone(selected.data);
        delete copyData.durationMs;
        const copy: WorkflowNode = {
          ...structuredClone(selected),
          id: `${selected.data.nodeType}-${crypto.randomUUID().slice(0, 8)}`,
          position: { x: selected.position.x + 42, y: selected.position.y + 42 },
          selected: false,
          data: { ...copyData, status: 'idle' },
        };
        set((state) => ({
          ...graphCheckpoint(state),
          nodes: [...state.nodes, copy],
          selectedNodeId: copy.id,
          results: null,
          project: touchProject(state.project),
          lastSavedAt: now(),
        }));
      },

      updateNodeConfig: (nodeId, key, value) =>
        set((state) => {
          const affected = getDownstreamNodeIds([nodeId], state.edges);
          return {
            ...graphCheckpoint(state),
            nodes: state.nodes.map((node) =>
              affected.includes(node.id)
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      config: node.id === nodeId ? { ...node.data.config, [key]: value } : node.data.config,
                      status: node.data.status === 'idle' ? 'idle' : 'stale',
                    },
                  }
                : node,
            ),
            results: null,
            project: touchProject(state.project),
            lastSavedAt: now(),
            audit: [
              ...state.audit,
              {
                id: makeId('audit'),
                timestamp: now(),
                kind: 'configuration',
                title: 'Node configuration changed',
                narrative: `${key} was updated. Completed downstream results were marked stale.`,
                actor: 'user',
                metadata: { node_id: nodeId, field: key },
              },
            ],
          };
        }),

      setNodeStatus: (nodeId, status, progress, durationMs) =>
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    status,
                    ...(progress === undefined ? {} : { progress }),
                    ...(durationMs === undefined ? {} : { durationMs }),
                  },
                }
              : node,
          ),
        })),

      markAllNodes: (status) =>
        set((state) => ({ nodes: state.nodes.map((node) => ({ ...node, data: { ...node.data, status } })) })),

      undo: () => {
        const state = get();
        const previous = state.past.at(-1);
        if (!previous) return;
        set({
          nodes: previous.nodes,
          edges: previous.edges,
          past: state.past.slice(0, -1),
          future: [cloneSnapshot(state.nodes, state.edges), ...state.future].slice(0, 40),
          selectedNodeId: null,
          results: null,
          lastSavedAt: now(),
        });
      },

      redo: () => {
        const state = get();
        const next = state.future[0];
        if (!next) return;
        set({
          nodes: next.nodes,
          edges: next.edges,
          past: [...state.past, cloneSnapshot(state.nodes, state.edges)].slice(-40),
          future: state.future.slice(1),
          selectedNodeId: null,
          results: null,
          lastSavedAt: now(),
        });
      },

      loadSample: () => {
        const graph = createDemoGraph();
        set((state) => ({
          ...graphCheckpoint(state),
          nodes: graph.nodes,
          edges: graph.edges,
          dataset: SAMPLE_DATASET,
          demoExecutionEnabled: true,
          warnings: [{ ...SAMPLE_WARNING, decision: 'pending' }],
          results: null,
          selectedNodeId: 'assign-roles',
          activePanel: 'data',
          bottomPanelOpen: true,
          project: touchProject({ ...INITIAL_PROJECT, createdAt: state.project.createdAt }),
          lastSavedAt: now(),
          audit: [
            ...state.audit,
            {
              id: makeId('audit'),
              timestamp: now(),
              kind: 'dataset',
              title: 'Bundled demonstration reset',
              narrative: 'The local example dataset and its transparent demonstration workflow were loaded.',
              actor: 'user',
            },
          ],
        }));
      },

      setDataset: (dataset) =>
        set((state) => ({
          dataset,
          demoExecutionEnabled: false,
          results: null,
          project: touchProject(state.project),
          lastSavedAt: now(),
          audit: [
            ...state.audit,
            {
              id: makeId('audit'),
              timestamp: now(),
              kind: 'dataset',
              title: 'Local dataset selected',
              narrative: `${dataset.name} was selected from this device. No dataset content was sent to a remote service.`,
              actor: 'user',
              metadata: { source: dataset.source, rows: dataset.rowCount },
            },
          ],
        })),

      approveRepair: (warningId) =>
        set((state) => {
          const warning = state.warnings.find((item) => item.id === warningId);
          if (!warning || !warning.canAutoRepair) return state;
          const downstream = getDownstreamNodeIds(warning.affectedNodeIds, state.edges);
          const bundledPatch = warning.source === 'bundled' ? warning.repairPatch : undefined;
          const repairColumn = bundledPatch?.action === 'remove_feature' && typeof bundledPatch.column === 'string'
            ? bundledPatch.column
            : null;
          return {
            ...graphCheckpoint(state),
            warnings: state.warnings.map((item) =>
              item.id === warningId ? { ...item, decision: 'approved' as const } : item,
            ),
            nodes: state.nodes.map((node) => {
              if (repairColumn && node.id === 'assign-roles') {
                const features = String(node.data.config.features ?? '')
                  .split(',')
                  .map((value) => value.trim())
                  .filter((value) => value && value !== repairColumn)
                  .join(', ');
                const ignored = Array.from(new Set([
                  ...String(node.data.config.ignored ?? '').split(',').map((value) => value.trim()).filter(Boolean),
                  repairColumn,
                ])).join(', ');
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config: { ...node.data.config, features, ignored },
                    status: 'stale',
                    warningCount: 0,
                  },
                };
              }
              return downstream.includes(node.id)
                ? { ...node, data: { ...node.data, status: 'stale' as const } }
                : node;
            }),
            results: null,
            project: touchProject(state.project),
            lastSavedAt: now(),
            audit: [
              ...state.audit,
              {
                id: makeId('audit'),
                timestamp: now(),
                kind: 'repair',
                title: 'Approved repair applied',
                narrative: `${warning.proposedRepair} Downstream nodes were marked stale and prior evaluation artifacts were cleared.`,
                actor: 'user',
                metadata: { rule_id: warning.ruleId, decision: 'approved' },
              },
            ],
          };
        }),

      rejectRepair: (warningId) =>
        set((state) => ({
          warnings: state.warnings.map((item) =>
            item.id === warningId ? { ...item, decision: 'rejected' as const } : item,
          ),
          audit: [
            ...state.audit,
            {
              id: makeId('audit'),
              timestamp: now(),
              kind: 'repair',
              title: 'Proposed repair rejected',
              narrative: 'The warning remains documented and the workflow configuration was not changed.',
              actor: 'user',
              metadata: { warning_id: warningId, decision: 'rejected' },
            },
          ],
          lastSavedAt: now(),
        })),

      setResults: (results) => set({ results }),
      setWarnings: (warnings) => set({ warnings }),
      replaceGraphFromServer: (nodes, edges) =>
        set({ nodes, edges, results: null, selectedNodeId: null, lastSavedAt: now() }),
      setRun: (run) => set({ run }),

      appendAudit: (event) =>
        set((state) => ({
          audit: [...state.audit, { ...event, id: makeId('audit'), timestamp: now() }],
          lastSavedAt: now(),
        })),

      setActivePanel: (activePanel, open = true) => set({ activePanel, bottomPanelOpen: open }),
      setBottomPanelOpen: (bottomPanelOpen) => set({ bottomPanelOpen }),
      setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
      setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
      setAboutOpen: (aboutOpen) => set({ aboutOpen }),
      setAdvancedOpen: (advancedOpen) => set({ advancedOpen }),

      notify: (toast) =>
        set((state) => ({ toasts: [...state.toasts.slice(-3), { ...toast, id: makeId('toast') }] })),
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    }),
    {
      name: 'libreml-workspace-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        project: state.project,
        nodes: state.nodes,
        edges: state.edges,
        dataset: state.dataset,
        warnings: state.warnings,
        results: state.results,
        audit: state.audit,
        lastSavedAt: state.lastSavedAt,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<WorkspaceState>;
        return {
          ...current,
          ...saved,
          nodes: (saved.nodes ?? current.nodes).map((node) => ({
            ...node,
            data: hydrateNodeData(node.data),
          })),
          run: INITIAL_RUN,
          past: [],
          future: [],
          toasts: [],
          backendOnline: null,
        };
      },
    },
  ),
);
