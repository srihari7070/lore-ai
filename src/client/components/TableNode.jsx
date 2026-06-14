import { Handle, Position } from 'reactflow';

// Database table rendered ER-style: a title bar over a list of fields, with
// relation fields marked. Used inside a drilled-in Database block.
export default function TableNode({ data, selected }) {
  const fields = data.fields || [];
  return (
    <div
      className={`w-60 overflow-hidden rounded-md border bg-node font-mono text-text-primary transition-shadow ${
        selected ? 'border-accent shadow-glow-strong' : 'border-accent/20 hover:shadow-glow'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 border-b border-accent/30 bg-accent/10 px-3 py-1.5">
        <span className="text-[11px] text-accent">▦</span>
        <span className="text-sm font-medium">{data.title}</span>
      </div>
      <div className="divide-y divide-white/5">
        {fields.length === 0 && <div className="px-3 py-1.5 text-[11px] text-text-muted">no columns</div>}
        {fields.slice(0, 24).map((f, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-3 py-1 text-[11px]">
            <span className={f.rel ? 'text-accent' : 'text-text-primary'}>{f.name}</span>
            <span className="text-text-muted">
              {f.rel ? `→ ${f.rel}` : f.type}
            </span>
          </div>
        ))}
        {fields.length > 24 && (
          <div className="px-3 py-1 text-[10px] text-text-muted">+{fields.length - 24} more</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
