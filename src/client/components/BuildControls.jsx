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
  const setBuildProgress = useGraphStore((s) => s.setBuildProgress);
  const pushActivity = useGraphStore((s) => s.pushActivity);
  const { buildStream, handoff, loading } = useAI();

  const models = config.builderModels || ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5'];

  const handleBuild = async () => {
    setBuildProgress({
      active: true,
      percent: 4,
      phase: 'interpreting',
      lastAction: 'Understanding your changes…',
      activities: [],
      startedAt: Date.now(),
    });
    try {
      await buildStream(
        { changes: stagedChanges(), context: summary, projectName: config.projectName, model: builderModel },
        (ev) => {
          if (ev.type === 'status') {
            setBuildProgress({ phase: ev.phase, lastAction: ev.label, percent: ev.phase === 'building' ? 12 : 6 });
          } else if (ev.type === 'activity') {
            pushActivity(ev.action);
          } else if (ev.type === 'done') {
            setBuildProgress({ percent: 100, phase: 'done', lastAction: 'Done' });
            setBuildResult(ev.result);
            if (ev.result?.ok) markCommitted();
            setTimeout(() => setBuildProgress(null), 600);
          } else if (ev.type === 'error') {
            setBuildProgress({ phase: 'error', lastAction: ev.error });
          }
        }
      );
    } catch {
      setBuildProgress({ phase: 'error', lastAction: 'Build failed — see error.' });
    }
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
      <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">apply&nbsp;changes:</span>
      {/* ▶ Build it for me — coming soon; hidden until prompt-size handling is stable */}
      <button
        onClick={handleHandoff}
        disabled={loading || !hasStaged}
        title="Copy a one-line prompt to paste into your OWN Claude Code session (you run it there and watch)"
        className="rounded-md border border-accent/40 px-3 py-1.5 font-mono text-sm text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? '…' : '→ Send to Claude Code'}
      </button>
    </div>
  );
}
