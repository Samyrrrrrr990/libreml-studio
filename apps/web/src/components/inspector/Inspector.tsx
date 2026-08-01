import {
  BookOpenText,
  BracketsCurly,
  CaretDown,
  Copy,
  Play,
  Trash,
  X,
} from '@phosphor-icons/react';
import { useMemo } from 'react';

import { NODE_BY_TYPE } from '../../data/catalog';
import { portColorClass } from '../../lib/portFamily';
import { useWorkspaceStore } from '../../store/workspace';
import type { ConfigField } from '../../types/workflow';
import { NodeIcon } from '../common/NodeIcon';

interface InspectorProps {
  onRunSelected: (nodeId: string) => Promise<void>;
}

interface FieldProps {
  field: ConfigField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}

function ConfigInput({ field, value, onChange }: FieldProps) {
  if (field.type === 'boolean') {
    return (
      <label className="switch-field">
        <span>
          <strong>{field.label}</strong>
          {field.description ? <small>{field.description}</small> : null}
        </span>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span className="switch-control" aria-hidden="true" />
      </label>
    );
  }

  return (
    <label className="form-field">
      <span>{field.label}</span>
      {field.type === 'select' ? (
        <span className="select-wrap">
          <select value={String(value)} onChange={(event) => onChange(event.target.value)}>
            {field.options?.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
            ))}
          </select>
          <CaretDown size={13} weight="bold" aria-hidden="true" />
        </span>
      ) : field.type === 'textarea' ? (
        <textarea value={String(value)} onChange={(event) => onChange(event.target.value)} rows={4} />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(value)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)}
        />
      )}
      {field.description ? <small>{field.description}</small> : null}
    </label>
  );
}

export function Inspector({ onRunSelected }: InspectorProps) {
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId);
  const selectedNode = useWorkspaceStore((state) =>
    state.nodes.find((node) => node.id === state.selectedNodeId),
  );
  const mode = useWorkspaceStore((state) => state.project.mode);
  const inspectorOpen = useWorkspaceStore((state) => state.inspectorOpen);
  const advancedOpen = useWorkspaceStore((state) => state.advancedOpen);
  const runStatus = useWorkspaceStore((state) => state.run.status);
  const updateNodeConfig = useWorkspaceStore((state) => state.updateNodeConfig);
  const duplicateSelectedNode = useWorkspaceStore((state) => state.duplicateSelectedNode);
  const removeSelectedNode = useWorkspaceStore((state) => state.removeSelectedNode);
  const setInspectorOpen = useWorkspaceStore((state) => state.setInspectorOpen);
  const setAdvancedOpen = useWorkspaceStore((state) => state.setAdvancedOpen);

  const spec = useMemo(
    () => (selectedNode ? NODE_BY_TYPE.get(selectedNode.data.nodeType) : undefined),
    [selectedNode],
  );

  if (!selectedNode || !spec || !selectedNodeId) {
    return (
      <aside className={`inspector${inspectorOpen ? ' is-open' : ''}`} aria-label="Node inspector">
        <div className="panel-heading">
          <div>
            <h2>Inspector</h2>
            <p>Configuration and methodological context.</p>
          </div>
          <button className="icon-button panel-close" type="button" onClick={() => setInspectorOpen(false)} aria-label="Close inspector">
            <X size={17} weight="bold" />
          </button>
        </div>
        <div className="inspector-empty">
          <BracketsCurly size={28} weight="duotone" />
          <strong>Select a node</strong>
          <span>Choose any canvas node to inspect its ports, assumptions, and parameters.</span>
        </div>
      </aside>
    );
  }

  const basicFields = spec.configFields.filter((field) => !field.advanced);
  const advancedFields = spec.configFields.filter((field) => field.advanced);
  const isRunning = runStatus === 'running' || runStatus === 'validating';

  return (
    <aside className={`inspector${inspectorOpen ? ' is-open' : ''}`} aria-label="Node inspector">
      <div className="inspector__header">
        <span className="inspector__icon">
          <NodeIcon icon={selectedNode.data.icon} size={20} weight="duotone" />
        </span>
        <div>
          <span>{selectedNode.data.category}</span>
          <h2>{selectedNode.data.label}</h2>
        </div>
        <button className="icon-button panel-close" type="button" onClick={() => setInspectorOpen(false)} aria-label="Close inspector">
          <X size={17} weight="bold" />
        </button>
      </div>

      <div className="inspector__scroll">
        <section className={`mode-guidance mode-${mode}`}>
          <div className="mode-guidance__label">
            {mode === 'learning' ? <BookOpenText size={16} weight="bold" /> : <BracketsCurly size={16} weight="bold" />}
            {mode === 'learning' ? 'Why this step matters' : 'Methodological role'}
          </div>
          <p>{mode === 'learning' ? selectedNode.data.learningExplanation : selectedNode.data.researchExplanation}</p>
          {mode === 'learning' ? (
            <dl className="learning-io">
              <div><dt>Receives</dt><dd>{selectedNode.data.inputs.map((port) => port.label).join(', ') || 'Nothing yet'}</dd></div>
              <div><dt>Produces</dt><dd>{selectedNode.data.outputs.map((port) => port.label).join(', ') || 'A saved action'}</dd></div>
            </dl>
          ) : (
            <dl className="research-contract">
              <div><dt>Node type</dt><dd>{spec.type}</dd></div>
              <div><dt>Contract</dt><dd>v{spec.version}.0.0</dd></div>
              <div><dt>Determinism</dt><dd>{spec.configFields.some((field) => field.key === 'random_seed') ? 'Seeded' : 'Deterministic'}</dd></div>
            </dl>
          )}
        </section>

        <section className="inspector-section">
          <div className="inspector-section__heading">
            <h3>Configuration</h3>
            <span>{basicFields.length + advancedFields.length} fields</span>
          </div>
          {basicFields.length === 0 ? (
            <p className="muted-copy">This node has no required parameters. Its behavior is defined by typed inputs.</p>
          ) : (
            <div className="config-fields">
              {basicFields.map((field) => (
                <ConfigInput
                  key={field.key}
                  field={field}
                  value={selectedNode.data.config[field.key] ?? field.defaultValue}
                  onChange={(value) => updateNodeConfig(selectedNode.id, field.key, value)}
                />
              ))}
            </div>
          )}
          {advancedFields.length > 0 ? (
            <details className="advanced-disclosure" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
              <summary>Advanced and reproducibility</summary>
              <div className="config-fields">
                {advancedFields.map((field) => (
                  <ConfigInput
                    key={field.key}
                    field={field}
                    value={selectedNode.data.config[field.key] ?? field.defaultValue}
                    onChange={(value) => updateNodeConfig(selectedNode.id, field.key, value)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <section className="inspector-section port-contract">
          <h3>Typed ports</h3>
          <div className="port-contract__columns">
            <div>
              <span>Inputs</span>
              {selectedNode.data.inputs.length ? selectedNode.data.inputs.map((port) => (
                <code key={port.id} className={portColorClass(port.type)} title={port.label}>
                  {port.type}
                </code>
              )) : <small>None</small>}
            </div>
            <div>
              <span>Outputs</span>
              {selectedNode.data.outputs.length ? selectedNode.data.outputs.map((port) => (
                <code key={port.id} className={portColorClass(port.type)} title={port.label}>
                  {port.type}
                </code>
              )) : <small>None</small>}
            </div>
          </div>
        </section>
      </div>

      <footer className="inspector__actions">
        <button className="button button-primary" type="button" onClick={() => void onRunSelected(selectedNode.id)} disabled={isRunning}>
          <Play size={16} weight="fill" />
          Run node
        </button>
        <button className="icon-button" type="button" onClick={duplicateSelectedNode} aria-label="Duplicate selected node">
          <Copy size={17} weight="bold" />
        </button>
        <button className="icon-button danger-control" type="button" onClick={removeSelectedNode} aria-label="Delete selected node">
          <Trash size={17} weight="bold" />
        </button>
      </footer>
    </aside>
  );
}
