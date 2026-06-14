import { Handle, Position } from 'reactflow';

const TYPE_LABELS = {
  core: { label: 'core', color: 'text-accent border-accent/40' },
  custom: { label: 'custom', color: 'text-text-muted border-white/10' },
  integration: { label: 'integration', color: 'text-success border-success/40' },
};

const STATUS_COLORS = {
  empty: 'bg-text-muted',
  'in-progress': 'bg-warning',
  complete: 'bg-success',
};

// Custom React Flow node. Visual only — selection is handled by the canvas.
export default function NodeCard({ data, selected }) {
  const type = TYPE_LABELS[data.nodeType] || TYPE_LABELS.custom;
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.empty;

  return (
    <div
      className={`w-56 rounded-lg border bg-node px-4 py-3 font-mono text-text-primary transition-shadow animate-fade-scale-in ${
        selected ? 'border-accent shadow-glow-strong' : 'border-accent/20 hover:shadow-glow'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{data.title}</span>
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusColor}`} title={data.status} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${type.color}`}>
          {type.label}
        </span>
        {data.stack?.length > 0 && (
          <span className="truncate text-[10px] text-text-muted">{data.stack.join(' · ')}</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
        <span>
          {data.children?.nodes?.length
            ? `${data.children.nodes.length} inside`
            : ''}
        </span>
        <span className="text-accent/70" title="Double-click to open">
          open ↘
        </span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
