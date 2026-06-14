import { useGraphStore } from '../store/graphStore.js';
import { useAI } from '../hooks/useAI.js';

const MODEL_LABELS = {
  'claude-haiku-4-5': 'Haiku (fast)',
  'claude-sonnet-4-6': 'Sonnet (balanced)',
  'claude-opus-4-8': 'Opus (max)',
};

// Builder model selector + the "Build" (commit) button. Build sends the staged
// diff → interpreter → Agent SDK, which edits the project files.
export default function BuildControls() {
  const config = useGraphStore((s) => s.config);
  const builderModel = useGraphStore((s) => s.builderModel);
  const setBuilderModel = useGraphStore((s) => s.setBuilderModel);
  const stagedChanges = useGraphStore((s) => s.stagedChanges);
  const hasStaged = useGraphStore((s) => s.hasStagedChanges());
  const summary = useGraphStore((s) => s.summary);
  const markCommitted = useGraphStore((s) => s.markCommitted);
  const setBuildResult = useGraphStore((s) => s.setBuildResult);
  const { build, loading } = useAI();

  const models = config.builderModels || ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5'];

  const handleBuild = async () => {
    const result = await build({
      changes: stagedChanges(),
      context: summary,
      projectName: config.projectName,
      model: builderModel,
    });
    setBuildResult(result);
    if (result.ok) markCommitted();
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={builderModel}
        onChange={(e) => setBuilderModel(e.target.value)}
        title="Builder model"
        className="rounded border border-white/10 bg-canvas px-2 py-1.5 font-mono text-xs text-text-primary"
      >
        {models.map((m) => (
          <option key={m} value={m}>
            {MODEL_LABELS[m] || m}
          </option>
        ))}
      </select>
      <button
        onClick={handleBuild}
        disabled={loading || !hasStaged}
        title={hasStaged ? 'Apply staged changes — the builder edits your project' : 'No staged changes since last build'}
        className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 font-mono text-sm text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Building…' : hasStaged ? '▶ Build' : '✓ Built'}
      </button>
    </div>
  );
}
