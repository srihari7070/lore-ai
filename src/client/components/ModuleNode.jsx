import { Handle, Position } from 'reactflow';

// Code module / file node rendered inside a drilled-in Backend/Frontend block.
// Shows the file/module and a compact line of its classes/functions (from notes).
export default function ModuleNode({ data, selected }) {
  return (
    <div
      className={`w-56 rounded-md border bg-node px-3 py-2 font-mono text-text-primary transition-shadow ${
        selected ? 'border-accent shadow-glow-strong' : 'border-accent/20 hover:shadow-glow'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted">{'</>'}</span>
        <span className="truncate text-sm font-medium" title={data.title}>
          {data.title}
        </span>
      </div>
      {data.notes && (
        <div className="mt-1.5 line-clamp-3 text-[10px] leading-relaxed text-text-muted">{data.notes}</div>
      )}
      {data.children?.nodes?.length > 0 && (
        <div className="mt-1.5 text-right text-[10px] text-accent/70">{data.children.nodes.length} inside ↘</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
