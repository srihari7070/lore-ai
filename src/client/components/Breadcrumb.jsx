import { useMemo } from 'react';
import { useGraphStore, graphAtPath } from '../store/graphStore.js';

// Drill-down breadcrumb. Shows the path from the root architecture down into
// whatever node the user has opened, with click-to-jump-back.
export default function Breadcrumb() {
  // Select raw state (stable refs) and derive crumbs in useMemo — never return
  // a freshly-built array straight from a selector (that triggers re-render loops).
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const path = useGraphStore((s) => s.path);
  const drillTo = useGraphStore((s) => s.drillTo);

  const crumbs = useMemo(() => {
    const out = [];
    let level = { nodes, edges };
    for (const id of path) {
      const n = level.nodes.find((x) => x.id === id);
      out.push({ id, title: n?.data?.title || '…' });
      level = n?.data?.children || { nodes: [], edges: [] };
    }
    return out;
  }, [nodes, edges, path]);

  if (crumbs.length === 0) return null; // at root — nothing to show

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-[6] flex items-center gap-1.5 rounded-md border border-accent/20 bg-node/95 px-3 py-1.5 font-mono text-xs backdrop-blur">
      <button onClick={() => drillTo(0)} className="text-accent hover:underline">
        architecture
      </button>
      {crumbs.map((c, i) => (
        <span key={c.id} className="flex items-center gap-1.5">
          <span className="text-text-muted">/</span>
          {i === crumbs.length - 1 ? (
            <span className="text-text-primary">{c.title}</span>
          ) : (
            <button onClick={() => drillTo(i + 1)} className="text-accent hover:underline">
              {c.title}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
