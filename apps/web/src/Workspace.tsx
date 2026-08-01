import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';

import { WorkflowCanvas } from './components/canvas/WorkflowCanvas';
import { Inspector } from './components/inspector/Inspector';
import { NodeLibrary } from './components/library/NodeLibrary';
import { AboutDialog } from './components/layout/AboutDialog';
import { ToastRegion } from './components/layout/ToastRegion';
import { TopBar } from './components/layout/TopBar';
import { BottomPanel } from './components/panels/BottomPanel';
import { useExecution } from './hooks/useExecution';
import { libreMlApi } from './lib/api';
import { parseLocalCsv } from './lib/csv';
import { useWorkspaceStore } from './store/workspace';

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

export function Workspace() {
  const libraryOpen = useWorkspaceStore((state) => state.libraryOpen);
  const inspectorOpen = useWorkspaceStore((state) => state.inspectorOpen);
  const bottomPanelOpen = useWorkspaceStore((state) => state.bottomPanelOpen);
  const backendOnline = useWorkspaceStore((state) => state.backendOnline);
  const project = useWorkspaceStore((state) => state.project);
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId);
  const setProjectId = useWorkspaceStore((state) => state.setProjectId);
  const setDataset = useWorkspaceStore((state) => state.setDataset);
  const updateNodeConfig = useWorkspaceStore((state) => state.updateNodeConfig);
  const addNode = useWorkspaceStore((state) => state.addNode);
  const notify = useWorkspaceStore((state) => state.notify);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const removeSelectedNode = useWorkspaceStore((state) => state.removeSelectedNode);
  const [uploading, setUploading] = useState(false);
  const aboutTriggerRef = useRef<HTMLButtonElement>(null);
  const execution = useExecution();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (command && event.key === 'Enter') {
        event.preventDefault();
        void execution.runAll();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId && !isEditableTarget(event.target)) {
        event.preventDefault();
        removeSelectedNode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [execution, redo, removeSelectedNode, selectedNodeId, undo]);

  const uploadDataset = async (file: File): Promise<void> => {
    setUploading(true);
    try {
      const preview = await parseLocalCsv(file);
      setDataset(preview);
      let csvNodeId = useWorkspaceStore.getState().nodes.find((node) => node.data.nodeType === 'csv_import')?.id;
      if (!csvNodeId) csvNodeId = addNode('csv_import') ?? undefined;
      if (csvNodeId) updateNodeConfig(csvNodeId, 'path', file.name);

      if (backendOnline) {
        let projectId = project.id;
        if (projectId.startsWith('local-')) {
          const created = await libreMlApi.createProject({
            title: project.title,
            research_question: project.researchQuestion,
            mode: project.mode,
          });
          projectId = created.id;
          setProjectId(projectId);
        }
        const response = await libreMlApi.uploadDataset(projectId, file);
        if (response && typeof response === 'object') {
          const record = response as Record<string, unknown>;
          const suggested = record.suggested_node_config;
          if (suggested && typeof suggested === 'object') {
            const config = (suggested as Record<string, unknown>).config;
            const path = config && typeof config === 'object'
              ? (config as Record<string, unknown>).path
              : undefined;
            if (csvNodeId && typeof path === 'string') updateNodeConfig(csvNodeId, 'path', path);
          }
        }
        notify({
          tone: 'success',
          title: 'Dataset imported locally',
          message: `${file.name} is registered with the local engine and previewed in the Data panel.`,
        });
      } else {
        notify({
          tone: 'warning',
          title: 'Browser preview only',
          message: `${file.name} was previewed locally. Start the Python engine before running this workflow; no sample results will be substituted.`,
        });
      }
      useWorkspaceStore.getState().setActivePanel('data');
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Dataset import failed',
        message: error instanceof Error ? error.message : 'The file could not be safely previewed.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <ReactFlowProvider>
      <div
        id="workspace"
        className={`workspace-shell${libraryOpen ? ' library-visible' : ''}${inspectorOpen ? ' inspector-visible' : ''}${bottomPanelOpen ? ' artifacts-visible' : ''}`}
      >
        <TopBar onRun={execution.runAll} onCancel={execution.cancel} aboutTriggerRef={aboutTriggerRef} />
        <main className="workspace-main">
          <NodeLibrary onUpload={uploadDataset} uploading={uploading} />
          <WorkflowCanvas />
          <Inspector onRunSelected={execution.runSelected} />
        </main>
        <BottomPanel onRun={execution.runAll} />
        <AboutDialog returnFocusRef={aboutTriggerRef} />
        <ToastRegion />
      </div>
    </ReactFlowProvider>
  );
}
