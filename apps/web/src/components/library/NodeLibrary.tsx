import {
  CaretDown,
  FileArrowUp,
  Flask,
  MagnifyingGlass,
  Plus,
  X,
} from '@phosphor-icons/react';
import { useMemo, useRef, useState, type DragEvent } from 'react';

import { NODE_CATALOG, NODE_CATEGORIES } from '../../data/catalog';
import { useWorkspaceStore } from '../../store/workspace';
import type { NodeCategory } from '../../types/workflow';
import { NodeIcon } from '../common/NodeIcon';

interface NodeLibraryProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
}

export function NodeLibrary({ onUpload, uploading }: NodeLibraryProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<NodeCategory | 'All'>('All');
  const fileRef = useRef<HTMLInputElement>(null);
  const addNode = useWorkspaceStore((state) => state.addNode);
  const loadSample = useWorkspaceStore((state) => state.loadSample);
  const libraryOpen = useWorkspaceStore((state) => state.libraryOpen);
  const setLibraryOpen = useWorkspaceStore((state) => state.setLibraryOpen);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return NODE_CATALOG.filter((node) => {
      const inCategory = category === 'All' || node.category === category;
      const matches =
        normalized.length === 0 ||
        [node.name, node.summary, node.category, ...node.keywords].some((value) =>
          value.toLowerCase().includes(normalized),
        );
      return inCategory && matches;
    });
  }, [category, query]);

  const startDrag = (event: DragEvent<HTMLElement>, nodeType: string, available: boolean) => {
    if (!available) return;
    event.dataTransfer.setData('application/libreml-node', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className={`node-library${libraryOpen ? ' is-open' : ''}`} aria-label="Node library">
      <div className="panel-heading">
        <div>
          <h2>Node library</h2>
          <p>Drag a supported operation onto the canvas.</p>
        </div>
        <button className="icon-button panel-close" type="button" onClick={() => setLibraryOpen(false)} aria-label="Close node library">
          <X size={17} weight="bold" />
        </button>
      </div>

      <section className="import-well" aria-labelledby="local-data-heading">
        <div className="import-well__copy">
          <FileArrowUp size={19} weight="duotone" aria-hidden="true" />
          <div>
            <strong id="local-data-heading">Bring in local data</strong>
            <span>CSV preview stays in this browser.</span>
          </div>
        </div>
        <div className="import-well__actions">
          <button className="button button-primary button-compact" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Reading…' : 'Choose CSV'}
          </button>
          <button className="button button-quiet button-compact" type="button" onClick={loadSample}>
            <Flask size={15} weight="bold" />
            Load sample
          </button>
        </div>
        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void onUpload(file);
            event.currentTarget.value = '';
          }}
          aria-label="Choose a local CSV dataset"
        />
      </section>

      <label className="search-field">
        <span className="visually-hidden">Search nodes</span>
        <MagnifyingGlass size={16} weight="bold" aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search methods and operations" />
        {query ? (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear node search">
            <X size={14} weight="bold" />
          </button>
        ) : null}
      </label>

      <label className="category-select">
        <span>Category</span>
        <select value={category} onChange={(event) => setCategory(event.target.value as NodeCategory | 'All')}>
          <option value="All">All methods</option>
          {NODE_CATEGORIES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <CaretDown size={13} weight="bold" aria-hidden="true" />
      </label>

      <div className="library-count" aria-live="polite">
        <span>{filtered.length} nodes</span>
        <span>Supported nodes can run now</span>
      </div>

      <div className="node-library__list">
        {filtered.length === 0 ? (
          <div className="library-empty">
            <MagnifyingGlass size={22} weight="duotone" />
            <strong>No matching nodes</strong>
            <span>Try a method name, data task, or category.</span>
          </div>
        ) : (
          filtered.map((node) => (
            <article
              className={`library-node${node.available ? '' : ' is-planned'}`}
              key={node.type}
              draggable={node.available}
              onDragStart={(event) => startDrag(event, node.type, node.available)}
            >
              <span className="library-node__icon">
                <NodeIcon icon={node.icon} size={18} weight="duotone" aria-hidden="true" />
              </span>
              <span className="library-node__copy">
                <strong>{node.name}</strong>
                <small>{node.summary}</small>
              </span>
              {node.available ? (
                <button type="button" onClick={() => addNode(node.type)} aria-label={`Add ${node.name}`}>
                  <Plus size={15} weight="bold" />
                </button>
              ) : (
                <span className="planned-label" title="Visible for architecture planning; not enabled in the local engine">
                  Preview
                </span>
              )}
            </article>
          ))
        )}
      </div>
      <p className="library-footnote">
        Preview nodes document the intended extension surface. They cannot be added or run until the local engine provides them.
      </p>
    </aside>
  );
}
