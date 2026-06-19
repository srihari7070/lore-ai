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
  const setHandoffResult = useGraphStore((s) => s.setHandoffResult);
  const { build, handoff, loading } = useAI();

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

  // Hand-off: write the instruction to .lore/next-prompt.md, copy the pointer
  // line to the clipboard, and show the user where to paste it.
  const handleHandoff = async () => {
    const result = await handoff({
      changes: stagedChanges(),
      context: summary,
      projectName: config.projectName,
    });
    let copied = false;
    try {
      await navigator.clipboard.writeText(result.pointer);
      copied = true;
    } catch {
      /* clipboard blocked — modal still shows the text to copy manually */
    }
    setHandoffResult({ ...result, copied });
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
        onClick={handleHandoff}
        disabled={loading || !hasStaged}
        title="Write the instruction to .lore/next-prompt.md and copy a pointer to paste into your own Claude Code"
        className="rounded-md border border-accent/40 px-3 py-1.5 font-mono text-sm text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? '…' : '→ Claude Code'}
      </button>
      <button
        onClick={handleBuild}
        disabled={loading || !hasStaged}
        title={hasStaged ? 'Apply staged changes automatically (Lore builds in the background)' : 'No staged changes since last build'}
        className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 font-mono text-sm text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Building…' : hasStaged ? '▶ Build' : '✓ Built'}
      </button>
    </div>
  );
}
