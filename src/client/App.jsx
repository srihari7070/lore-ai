import { useEffect, useState, useCallback } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { useGraphStore } from './store/graphStore.js';
import { useAI } from './hooks/useAI.js';
import Toolbar from './components/Toolbar.jsx';
import Canvas from './components/Canvas.jsx';
import NodeExpanded from './components/NodeExpanded.jsx';
import VoiceInput from './components/VoiceInput.jsx';

export default function App() {
  const setConfig = useGraphStore((s) => s.setConfig);
  const config = useGraphStore((s) => s.config);
  const hasGraph = useGraphStore((s) => s.nodes.length > 0);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const compiledMarkdown = useGraphStore((s) => s.compiledMarkdown);
  const buildResult = useGraphStore((s) => s.buildResult);
  const handoffResult = useGraphStore((s) => s.handoffResult);
  const buildProgress = useGraphStore((s) => s.buildProgress);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        setConfig(cfg);
        setConfigLoaded(true);
      })
      .catch(() => setConfigLoaded(true));
  }, [setConfig]);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <Toolbar />
        <div className="relative flex-1 overflow-hidden">
          <Canvas />
          {selectedNodeId && <NodeExpanded />}
          {!selectedNodeId && <DecisionsPanel />}

          {configLoaded && !hasGraph && config.mode === 'plan' && <InitialPrompt />}
          {configLoaded && !hasGraph && (config.mode === 'scan' || config.mode === 'deep') && (
            <ScanRunner deep={config.mode === 'deep'} />
          )}
          {configLoaded && config.mode === 'sync' && <SyncPanel />}

          {buildProgress?.active && <BuildProgressModal />}
          {compiledMarkdown && <CompiledModal />}
          {buildResult && <BuildResultModal />}
          {handoffResult && <HandoffModal />}
        </div>
      </div>
    </ReactFlowProvider>
  );
}

// ── Live build progress: bar + real actions as they stream in ──────────────
function BuildProgressModal() {
  const bp = useGraphStore((s) => s.buildProgress);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  if (!bp) return null;
  const elapsed = bp.startedAt ? Math.floor((Date.now() - bp.startedAt) / 1000) : 0;
  const isError = bp.phase === 'error';
  const pct = Math.max(0, Math.min(100, Math.round(bp.percent || 0)));

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/85 p-8 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-accent/40 bg-node p-6 shadow-glow-strong">
        <div className="mb-3 flex items-center justify-between font-mono text-sm">
          <span className={isError ? 'text-warning' : 'text-accent'}>
            {isError ? '✕ Build failed' : bp.phase === 'done' ? '✓ Build complete' : '▶ Building…'}
          </span>
          <span className="text-text-muted">{elapsed}s · {pct}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isError ? 'bg-warning' : 'bg-accent'}`}
            style={{ width: `${isError ? 100 : pct}%` }}
          />
        </div>

        {/* Current action */}
        <p className="mt-3 truncate font-mono text-xs text-text-primary" title={bp.lastAction}>
          {bp.lastAction || 'Working…'}
        </p>

        {/* Recent activity feed */}
        {bp.activities?.length > 0 && (
          <div className="lore-scroll mt-3 max-h-40 space-y-1 overflow-auto rounded border border-white/10 bg-canvas p-2">
            {bp.activities.slice(-12).map((a, i) => (
              <div key={i} className="font-mono text-[11px] text-text-muted">
                <span className="text-accent/60">·</span> {a}
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-[10px] text-text-muted">
          The percentage tracks activity, not exact completion — Claude decides its own steps.
        </p>
      </div>
    </div>
  );
}

// ── Hand-off: pointer copied to clipboard, paste into your own Claude Code ───
function HandoffModal() {
  const handoffResult = useGraphStore((s) => s.handoffResult);
  const setHandoffResult = useGraphStore((s) => s.setHandoffResult);
  const r = handoffResult;
  const [recopied, setRecopied] = useState(false);

  const copyAgain = async () => {
    try {
      await navigator.clipboard.writeText(r.pointer);
      setRecopied(true);
      setTimeout(() => setRecopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-8 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-accent/40 bg-node shadow-glow-strong">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="font-mono text-sm text-success">
            {r.copied ? '✓ Copied to clipboard' : '⚠ Copy the text below'}
          </h2>
          <button
            onClick={() => setHandoffResult(null)}
            className="rounded border border-white/10 px-3 py-1 font-mono text-xs text-text-muted hover:text-text-primary"
          >
            close
          </button>
        </div>
        <div className="lore-scroll flex-1 space-y-4 overflow-auto p-5 text-sm">
          <p className="text-text-primary">
            {r.copied
              ? 'Go back to your Claude Code session and paste — it will read the instruction file and run the changes while you watch.'
              : 'Clipboard was blocked. Copy this line and paste it into your Claude Code session:'}
          </p>
          <div className="rounded border border-accent/30 bg-canvas p-3">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-text-muted">
              Pasted into Claude Code
            </div>
            <p className="font-mono text-xs leading-relaxed text-accent">{r.pointer}</p>
            <button
              onClick={copyAgain}
              className="mt-2 rounded border border-accent/40 px-2 py-0.5 font-mono text-[11px] text-accent hover:bg-accent/10"
            >
              {recopied ? 'copied' : 'copy again'}
            </button>
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-text-muted">
              Written to {r.path} (what Claude Code will do)
            </div>
            <pre className="lore-scroll max-h-60 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-canvas p-3 font-mono text-xs leading-relaxed text-text-primary">
              {r.instruction}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Post-build result: shows the instruction the interpreter wrote + outcome ─
function BuildResultModal() {
  const buildResult = useGraphStore((s) => s.buildResult);
  const setBuildResult = useGraphStore((s) => s.setBuildResult);
  const r = buildResult;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-8 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-accent/30 bg-node shadow-glow-strong">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className={`font-mono text-sm ${r.ok ? 'text-success' : 'text-warning'}`}>
            {r.ok ? '✓ Build applied to the project' : '✕ Build failed'}
            <span className="ml-3 text-text-muted">
              {r.numTurns} turns · ${Number(r.costUsd || 0).toFixed(4)} · {r.authMode}
            </span>
          </h2>
          <button
            onClick={() => setBuildResult(null)}
            className="rounded border border-white/10 px-3 py-1 font-mono text-xs text-text-muted hover:text-text-primary"
          >
            close
          </button>
        </div>
        <div className="lore-scroll flex-1 space-y-4 overflow-auto p-5 text-sm">
          {r.interpreted && (
            <div>
              <div className="mb-1 font-mono text-xs uppercase tracking-wide text-text-muted">
                Interpreter instruction (Haiku)
              </div>
              <p className="rounded border border-white/10 bg-canvas p-3 font-mono text-xs leading-relaxed text-text-primary">
                {r.instruction}
              </p>
            </div>
          )}
          <div>
            <div className="mb-1 font-mono text-xs uppercase tracking-wide text-text-muted">
              Builder summary
            </div>
            <pre className="lore-scroll whitespace-pre-wrap rounded border border-white/10 bg-canvas p-3 font-mono text-xs leading-relaxed text-text-primary">
              {r.text || '(no summary returned)'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan mode: centered prompt to seed the graph ──────────────────────────
function InitialPrompt() {
  const [description, setDescription] = useState('');
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const { generatePlan, loading, error } = useAI();

  const appendTranscript = useCallback(
    (text) => setDescription((d) => (d ? `${d} ${text}` : text)),
    []
  );

  const submit = async () => {
    if (!description.trim()) return;
    const plan = await generatePlan(description);
    loadGraph(plan);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-accent/20 bg-node p-8 shadow-glow">
        <h1 className="mb-2 font-mono text-xl text-text-primary">What are you building?</h1>
        <p className="mb-4 text-sm text-text-muted">
          Describe your project in a few lines or use the microphone. The AI maps the minimum
          required architecture as a starting node graph.
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. A SaaS app for freelancers to track invoices, with a dashboard, payment integration, and email reminders."
          className="lore-scroll h-40 w-full resize-none rounded-md border border-accent/20 bg-canvas p-3 font-mono text-sm text-text-primary placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
        />
        <div className="mt-4 flex items-center justify-between">
          <VoiceInput onTranscript={appendTranscript} />
          <button
            onClick={submit}
            disabled={loading || !description.trim()}
            className="rounded-md bg-accent px-5 py-2 font-mono text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'Generating graph…' : 'Generate graph →'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-warning">{error}</p>}
      </div>
    </div>
  );
}

// ── Scan / deep-scan: crawl the codebase and reverse-engineer a graph ──────
function ScanRunner({ deep = false }) {
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const { runScan, runDeepScan, loading, error } = useAI();
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const scan = useCallback(async () => {
    setStarted(true);
    const result = await (deep ? runDeepScan() : runScan());
    loadGraph(result);
  }, [deep, runScan, runDeepScan, loadGraph]);

  // Tick an elapsed-seconds timer while the scan runs.
  useEffect(() => {
    if (!started || !loading) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [started, loading]);

  // Scans are a single request (no live events), so the bar is a time-based
  // estimate that eases toward ~92% — honest, and it shows things are moving.
  const expected = deep ? 90 : 35; // rough seconds
  const pct = Math.min(92, Math.round(100 * (1 - Math.exp(-elapsed / expected))));
  const running = started && loading;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-success/20 bg-node p-8 text-center shadow-glow">
        <h1 className="mb-2 font-mono text-xl text-text-primary">
          {deep ? 'Deep scan this codebase' : 'Scan this codebase'}
        </h1>
        <p className="mb-5 text-sm text-text-muted">
          {deep
            ? 'Reads your code (any language) and database schema, then assembles a drill-down map. Heavier, but you see the real internals.'
            : 'Crawls the file tree, dependencies, and frameworks, then asks Claude for a high-level architecture map.'}
        </p>

        {running ? (
          <div>
            <div className="mb-2 flex items-center justify-between font-mono text-xs text-text-muted">
              <span className="text-success">{deep ? 'Reading code & mapping…' : 'Scanning & mapping…'}</span>
              <span>{elapsed}s · {pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-[10px] text-text-muted">
              Estimate — Claude is reading the code; this usually takes {deep ? '1–3 min' : 'under a minute'}.
            </p>
          </div>
        ) : (
          <button
            onClick={scan}
            className="rounded-md bg-success px-5 py-2 font-mono text-sm text-bg transition-opacity hover:opacity-90"
          >
            {deep ? 'Start deep scan' : 'Start scan'}
          </button>
        )}
        {error && <p className="mt-3 text-sm text-warning">{error}</p>}
      </div>
    </div>
  );
}

// ── Sync mode: diff lore.md against a fresh light scan ────────────────────
function SyncPanel() {
  const { runSync, loading, error } = useAI();
  const [patches, setPatches] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const sync = useCallback(async () => {
    const result = await runSync();
    setPatches(result.patches || []);
  }, [runSync]);

  if (dismissed) return null;

  return (
    <div className="absolute right-4 top-4 z-20 w-96 rounded-xl border border-warning/30 bg-node p-5 shadow-glow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-sm uppercase tracking-wide text-warning">Sync</h2>
        <button onClick={() => setDismissed(true)} className="text-text-muted hover:text-text-primary">
          ✕
        </button>
      </div>
      {patches === null ? (
        <>
          <p className="mb-4 text-xs text-text-muted">
            Diff the current codebase against the existing lore.md and surface only what changed.
          </p>
          <button
            onClick={sync}
            disabled={loading}
            className="rounded-md bg-warning px-4 py-1.5 font-mono text-sm text-bg disabled:opacity-50"
          >
            {loading ? 'Diffing…' : 'Run sync'}
          </button>
        </>
      ) : patches.length === 0 ? (
        <p className="text-sm text-success">No changes — lore.md is in sync.</p>
      ) : (
        <div className="lore-scroll max-h-80 space-y-2 overflow-y-auto">
          {patches.map((p, i) => (
            <div key={i} className="rounded border border-white/10 bg-canvas p-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                    p.change === 'added'
                      ? 'bg-success/20 text-success'
                      : p.change === 'removed'
                      ? 'bg-warning/20 text-warning'
                      : 'bg-accent/20 text-accent'
                  }`}
                >
                  {p.change}
                </span>
                <span className="font-mono text-xs text-text-primary">{p.node}</span>
              </div>
              <p className="mt-1 text-xs text-text-muted">{p.detail}</p>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-xs text-warning">{error}</p>}
    </div>
  );
}

// ── Floating minimum-required-decisions checklist (gating AI) ─────────────
function DecisionsPanel() {
  const decisions = useGraphStore((s) => s.decisions);
  const toggleDecision = useGraphStore((s) => s.toggleDecision);
  const [open, setOpen] = useState(true);

  if (decisions.length === 0) return null;
  const remaining = decisions.filter((d) => !d.answered).length;

  return (
    <div className="absolute right-4 top-4 z-[5] w-80 rounded-xl border border-accent/20 bg-node/95 p-4 shadow-glow backdrop-blur">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between font-mono text-xs uppercase tracking-wide text-accent"
      >
        <span>Required decisions</span>
        <span className="text-text-muted">
          {remaining ? `${remaining} left` : 'all set'} {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {decisions.map((d) => (
            <li key={d.id}>
              <label className="flex cursor-pointer items-start gap-2 text-xs text-text-primary">
                <input
                  type="checkbox"
                  checked={d.answered}
                  onChange={() => toggleDecision(d.id)}
                  className="mt-0.5 accent-accent"
                />
                <span className={d.answered ? 'text-text-muted line-through' : ''}>{d.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Post-compile modal showing the written lore.md ────────────────────────
function CompiledModal() {
  const compiledMarkdown = useGraphStore((s) => s.compiledMarkdown);
  const setCompiled = useGraphStore((s) => s.setCompiled);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(compiledMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-8 backdrop-blur-sm">
      <div className="flex h-full max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-success/30 bg-node shadow-glow-strong">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="font-mono text-sm text-success">✓ lore.md written to project root</h2>
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="rounded border border-accent/40 px-3 py-1 font-mono text-xs text-accent hover:bg-accent/10"
            >
              {copied ? 'copied' : 'copy'}
            </button>
            <button
              onClick={() => setCompiled(null)}
              className="rounded border border-white/10 px-3 py-1 font-mono text-xs text-text-muted hover:text-text-primary"
            >
              close
            </button>
          </div>
        </div>
        <pre className="lore-scroll flex-1 overflow-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-text-primary">
          {compiledMarkdown}
        </pre>
      </div>
    </div>
  );
}
