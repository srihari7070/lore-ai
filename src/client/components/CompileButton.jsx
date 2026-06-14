import { useGraphStore } from '../store/graphStore.js';
import { useAI } from '../hooks/useAI.js';

// Triggers lore.md generation. Pulses once every required decision is answered.
// Gating is a warning, never a hard block.
export default function CompileButton() {
  const decisions = useGraphStore((s) => s.decisions);
  const nodes = useGraphStore((s) => s.nodes);
  const serializeGraph = useGraphStore((s) => s.serializeGraph);
  const config = useGraphStore((s) => s.config);
  const setCompiled = useGraphStore((s) => s.setCompiled);
  const { compile, loading } = useAI();

  const unanswered = decisions.filter((d) => !d.answered).length;
  const allAnswered = decisions.length > 0 && unanswered === 0;

  const handleCompile = async () => {
    if (nodes.length === 0) {
      alert('Add at least one node before compiling.');
      return;
    }
    if (unanswered > 0) {
      const proceed = window.confirm(
        `${unanswered} required decision${unanswered > 1 ? 's are' : ' is'} still unanswered. Compile anyway?`
      );
      if (!proceed) return;
    }
    const result = await compile(serializeGraph(), config.projectName);
    setCompiled(result.content);
  };

  return (
    <button
      onClick={handleCompile}
      disabled={loading}
      className={`rounded-md px-4 py-1.5 font-mono text-sm font-medium text-white transition-all disabled:opacity-50 ${
        allAnswered ? 'bg-accent animate-pulse-accent' : 'bg-accent/80 hover:bg-accent'
      }`}
    >
      {loading ? 'Compiling…' : 'Compile to Lore'}
    </button>
  );
}
