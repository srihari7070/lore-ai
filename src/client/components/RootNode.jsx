import { Handle, Position } from 'reactflow';

// The bold project root at the top of the map. Everything connects to it, so
// the top level reads as a tree (project → its main parts) instead of a row.
export default function RootNode({ data }) {
  return (
    <div className="rounded-lg border-2 border-accent bg-node px-6 py-3 text-center shadow-glow">
      <div className="font-mono text-base font-bold text-accent">◆ {data.title}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-widest text-text-muted">
        {data.subtitle || 'architecture'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
