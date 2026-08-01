import { CaretDown, FileArrowUp, Flask, MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';

import { NODE_CATALOG, NODE_CATEGORIES } from '../../data/catalog';
import { useWorkspaceStore } from '../../store/workspace';
import type { NodeCategory, NodeSpec } from '../../types/workflow';
import { NodeIcon } from '../common/NodeIcon';

interface NodeLibraryProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
}

export function NodeLibrary({ onUpload, uploading }: NodeLibraryProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<NodeCategory | 'All'>('All');
  const [cursor, setCursor] = useState(-1);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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

  /**
   * The catalogue grouped by category, in the catalogue's own category order.
   *
   * Forty-nine entries in one flat list forced a linear read to find anything.
   * Grouping restores the mental model the categories already imply, and the
   * flat `ordered` array alongside it is what the arrow keys traverse, so
   * keyboard movement crosses group boundaries without special-casing them.
   */
  const { groups, ordered } = useMemo(() => {
    const byCategory = new Map<NodeCategory, NodeSpec[]>();
    for (const node of filtered) {
      const bucket = byCategory.get(node.category);
      if (bucket) bucket.push(node);
      else byCategory.set(node.category, [node]);
    }
    const sorted = NODE_CATEGORIES.filter((name) => byCategory.has(name)).map((name) => ({
      category: name,
      nodes: byCategory.get(name) ?? [],
    }));
    return { groups: sorted, ordered: sorted.flatMap((group) => group.nodes) };
  }, [filtered]);

  const startDrag = (event: DragEvent<HTMLElement>, nodeType: string, available: boolean) => {
    if (!available) return;
    event.dataTransfer.setData('application/libreml-node', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const place = (node: NodeSpec) => {
    if (!node.available) return;
    addNode(node.type);
  };

  // Arrow keys move a cursor through the flattened list; Enter places the node.
  // Held on the container so the handler survives the list re-rendering under
  // an active filter.
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (ordered.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = (cursor + delta + ordered.length) % ordered.length;
      setCursor(next);
      const rows = listRef.current?.querySelectorAll<HTMLButtonElement>('.library-node');
      rows?.[next]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter' && cursor >= 0) {
      event.preventDefault();
      const node = ordered[cursor];
      if (node) place(node);
    }
  };

  let flatIndex = -1;

  return (
    <aside className={`node-library${libraryOpen ? ' is-open' : ''}`} aria-label="Node library">
      <div className="panel-heading">
        <div>
          <h2>Node library</h2>
          <p>Drag onto the canvas, or press Enter to place.</p>
        </div>
        <button
          className="icon-button panel-close"
          type="button"
          onClick={() => setLibraryOpen(false)}
          aria-label="Close node library"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <section className="library-import" aria-labelledby="local-data-heading">
        <div className="library-import__copy">
          <FileArrowUp size={18} weight="duotone" aria-hidden="true" />
          <div>
            <strong id="local-data-heading">Bring in local data</strong>
            <span>Your file stays on this machine.</span>
          </div>
        </div>
        <div className="library-import__actions">
          <button
            className="button button-primary button-compact"
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Reading…' : 'Choose CSV'}
          </button>
          <button className="button button-quiet button-compact" type="button" onClick={loadSample}>
            <Flask size={14} weight="bold" aria-hidden="true" />
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

      <div className="library-toolbar">
        <label className="search-field">
          <span className="visually-hidden">Search nodes</span>
          <MagnifyingGlass size={15} weight="bold" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(-1);
            }}
            onKeyDown={onListKeyDown}
            placeholder="Search methods and operations"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear node search">
              <X size={13} weight="bold" />
            </button>
          ) : null}
        </label>

        <div className="library-filters">
          <span className="mono" aria-live="polite">
            {filtered.length} of {NODE_CATALOG.length}
          </span>
          <span className="category-select">
            <span className="visually-hidden">Filter by category</span>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as NodeCategory | 'All');
                setCursor(-1);
              }}
              aria-label="Filter nodes by category"
            >
              <option value="All">All categories</option>
              {NODE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <CaretDown size={12} weight="bold" aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="node-library__list" ref={listRef} onKeyDown={onListKeyDown}>
        {groups.length === 0 ? (
          <div className="library-empty">
            <MagnifyingGlass size={22} weight="duotone" />
            <strong>No matching nodes</strong>
            <span>Try a method name, a data task, or a category.</span>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.category}>
              <p className="library-group__label">{group.category}</p>
              {group.nodes.map((node) => {
                flatIndex += 1;
                const index = flatIndex;
                return (
                  <button
                    type="button"
                    className={`library-node${node.available ? '' : ' is-planned'}${
                      index === cursor ? ' is-cursor' : ''
                    }`}
                    key={node.type}
                    draggable={node.available}
                    disabled={!node.available}
                    onDragStart={(event) => startDrag(event, node.type, node.available)}
                    onClick={() => place(node)}
                    onFocus={() => setCursor(index)}
                    title={
                      node.available
                        ? `${node.name}: ${node.summary}`
                        : `${node.name} is documented but not yet provided by the local engine.`
                    }
                  >
                    <span className="library-node__icon">
                      <NodeIcon icon={node.icon} size={16} weight="duotone" aria-hidden="true" />
                    </span>
                    <span className="library-node__copy">
                      <strong>{node.name}</strong>
                      <small>{node.summary}</small>
                    </span>
                    {node.available ? (
                      <span className="library-node__affordance" aria-hidden="true">
                        <Plus size={14} weight="bold" />
                      </span>
                    ) : (
                      <span className="badge">Preview</span>
                    )}
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
