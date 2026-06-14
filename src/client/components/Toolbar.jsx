import { useGraphStore } from '../store/graphStore.js';
import CompileButton from './CompileButton.jsx';
import BuildControls from './BuildControls.jsx';

const AUTH_LABELS = {
  'api-key': 'API key',
  subscription: 'subscription',
};

const MODE_BADGES = {
  plan: 'border-accent/40 text-accent',
  scan: 'border-success/40 text-success',
  sync: 'border-warning/40 text-warning',
};

// Top toolbar: branding, mode, project, add-node, and compile.
export default function Toolbar() {
  const config = useGraphStore((s) => s.config);
  const addNode = useGraphStore((s) => s.addNode);
  const hasGraph = useGraphStore((s) => s.nodes.length > 0);

  return (
    <header className="flex items-center justify-between border-b border-accent/20 bg-bg px-5 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold text-accent">◆ Lore</span>
          <span className="font-mono text-xs text-text-muted">AI</span>
        </div>
        <span className={`rounded border px-2 py-0.5 font-mono text-[11px] uppercase ${MODE_BADGES[config.mode] || ''}`}>
          {config.mode}
        </span>
        {config.projectName && (
          <span className="font-mono text-xs text-text-muted">{config.projectName}</span>
        )}
        {config.authMode && (
          <span className="rounded border border-white/10 px-2 py-0.5 font-mono text-[10px] text-text-muted" title="How the builder authenticates to Claude">
            {AUTH_LABELS[config.authMode] || config.authMode}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {hasGraph && (
          <button
            onClick={() => addNode()}
            className="rounded-md border border-accent/40 px-3 py-1.5 font-mono text-sm text-accent transition-colors hover:bg-accent/10"
          >
            + Node
          </button>
        )}
        <CompileButton />
        {hasGraph && <BuildControls />}
      </div>
    </header>
  );
}
