import { useState } from 'react';
import { useGraphStore, graphAtPath } from '../store/graphStore.js';
import { useAI } from '../hooks/useAI.js';
import DumpBox from './DumpBox.jsx';
import StackPicker from './StackPicker.jsx';

const STATUSES = ['empty', 'in-progress', 'complete'];

// Slide-in planning panel for a single node (resolved at the current drill level).
export default function NodeExpanded() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const node = useGraphStore((s) => {
    const { nodes } = graphAtPath(s.nodes, s.edges, s.path);
    return nodes.find((n) => n.id === s.selectedNodeId);
  });
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const removeNode = useGraphStore((s) => s.removeNode);
  const selectNode = useGraphStore((s) => s.selectNode);
  const drillInto = useGraphStore((s) => s.drillInto);
  const { structureDump, loading, error } = useAI();

  const [proposals, setProposals] = useState([]);

  if (!node) return null;
  const { data } = node;

  const set = (patch) => updateNodeData(selectedNodeId, patch);

  const handleStructure = async () => {
    setProposals([]);
    const result = await structureDump(data.dump, data.title);
    setProposals(result.subNodes || []);
    if (data.status === 'empty') set({ status: 'in-progress' });
  };

  const acceptProposal = (proposal, index) => {
    set({ subNodes: [...data.subNodes, proposal] });
    setProposals(proposals.filter((_, i) => i !== index));
  };

  const removeSubNode = (index) => {
    set({ subNodes: data.subNodes.filter((_, i) => i !== index) });
  };

  return (
    <aside className="lore-scroll absolute right-0 top-0 z-10 flex h-full w-[420px] flex-col gap-5 overflow-y-auto border-l border-accent/20 bg-node-expanded p-5 shadow-glow-strong animate-slide-in-right">
      <header className="flex items-start justify-between gap-3">
        <input
          value={data.title}
          onChange={(e) => set({ title: e.target.value })}
          className="w-full bg-transparent font-mono text-lg font-semibold text-text-primary focus:outline-none"
        />
        <button
          onClick={() => selectNode(null)}
          className="shrink-0 rounded px-2 text-text-muted hover:text-text-primary"
          title="Close panel"
        >
          ✕
        </button>
      </header>

      <div className="flex items-center gap-3 text-xs">
        <select
          value={data.nodeType}
          onChange={(e) => set({ nodeType: e.target.value })}
          className="rounded border border-white/10 bg-canvas px-2 py-1 font-mono text-text-primary"
        >
          <option value="core">core</option>
          <option value="custom">custom</option>
          <option value="integration">integration</option>
        </select>
        <select
          value={data.status}
          onChange={(e) => set({ status: e.target.value })}
          className="rounded border border-white/10 bg-canvas px-2 py-1 font-mono text-text-primary"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {data.rationale && (
        <p className="rounded border border-white/5 bg-canvas/60 p-2 text-xs italic text-text-muted">
          {data.rationale}
        </p>
      )}

      <button
        onClick={() => drillInto(selectedNodeId)}
        className="flex items-center justify-between rounded-md border border-accent/30 bg-accent/5 px-3 py-2 font-mono text-xs text-accent transition-colors hover:bg-accent/15"
        title="Open this node's internal structure"
      >
        <span>Open internals{data.children?.nodes?.length ? ` (${data.children.nodes.length})` : ''}</span>
        <span>↘</span>
      </button>

      <DumpBox value={data.dump} onChange={(dump) => set({ dump })} />

      <div>
        <button
          onClick={handleStructure}
          disabled={loading || !data.dump.trim()}
          className="rounded-md bg-accent px-3 py-1.5 font-mono text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Structuring…' : 'Structure ↦ sub-nodes'}
        </button>
        {error && <span className="ml-3 text-xs text-warning">{error}</span>}
      </div>

      {proposals.length > 0 && (
        <div className="space-y-2 rounded-md border border-accent/30 bg-canvas/60 p-3">
          <div className="text-xs uppercase tracking-wide text-accent">Proposed sub-nodes</div>
          {proposals.map((p, i) => (
            <div key={i} className="flex items-start justify-between gap-2 rounded border border-white/10 p-2">
              <div>
                <div className="font-mono text-sm text-text-primary">{p.title}</div>
                {p.summary && <div className="text-xs text-text-muted">{p.summary}</div>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => acceptProposal(p, i)}
                  className="rounded border border-success/40 px-2 py-0.5 text-xs text-success hover:bg-success/10"
                >
                  accept
                </button>
                <button
                  onClick={() => setProposals(proposals.filter((_, j) => j !== i))}
                  className="rounded border border-white/10 px-2 py-0.5 text-xs text-text-muted hover:text-text-primary"
                >
                  reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.subNodes.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-text-muted">Sub-nodes</label>
          {data.subNodes.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-2 rounded border border-accent/20 bg-canvas p-2">
              <div>
                <div className="font-mono text-sm text-text-primary">{s.title}</div>
                {s.summary && <div className="text-xs text-text-muted">{s.summary}</div>}
              </div>
              <button
                onClick={() => removeSubNode(i)}
                className="shrink-0 text-text-muted hover:text-warning"
                title="Delete sub-node"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <StackPicker selected={data.stack} onChange={(stack) => set({ stack })} />

      <div>
        <label className="mb-2 block text-xs uppercase tracking-wide text-text-muted">
          Notes (preserved verbatim in lore.md)
        </label>
        <textarea
          value={data.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Decisions, reasoning, constraints — kept exactly as written."
          className="lore-scroll h-28 w-full resize-y rounded-md border border-accent/20 bg-canvas p-3 font-mono text-sm text-text-primary placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

      <button
        onClick={() => removeNode(selectedNodeId)}
        className="mt-auto rounded-md border border-warning/40 px-3 py-1.5 font-mono text-xs text-warning hover:bg-warning/10"
      >
        Delete node
      </button>
    </aside>
  );
}
