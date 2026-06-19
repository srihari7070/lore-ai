import { useState, useCallback } from 'react';

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/**
 * Wraps every AI/server call with a shared loading + error state so components
 * can show spinners and surface failures without re-implementing fetch logic.
 */
export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrap = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generatePlan = useCallback(
    (description) => wrap(() => post('/api/ai/plan', { description })),
    [wrap]
  );

  const structureDump = useCallback(
    (dump, nodeTitle) => wrap(() => post('/api/ai/structure', { dump, nodeTitle })),
    [wrap]
  );

  const runScan = useCallback(() => wrap(() => post('/api/scan')), [wrap]);

  const runDeepScan = useCallback(() => wrap(() => post('/api/scan/deep')), [wrap]);

  const runSync = useCallback(() => wrap(() => post('/api/scan/sync')), [wrap]);

  const compile = useCallback(
    (graph, projectName) => wrap(() => post('/api/blueprint/compile', { graph, projectName })),
    [wrap]
  );

  // Commit: send staged changes → interpreter → builder edits the project.
  const build = useCallback(
    ({ changes, context, projectName, model }) =>
      wrap(() => post('/api/build', { changes, context, projectName, model })),
    [wrap]
  );

  // Streaming build: POSTs and reads Server-Sent Events, calling onEvent for
  // each progress event (status / activity / done / error).
  const buildStream = useCallback(async ({ changes, context, projectName, model }, onEvent) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/build/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes, context, projectName, model }),
      });
      if (!res.body) throw new Error('Streaming not supported by the server response.');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (line) {
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === 'error') setError(ev.error);
              onEvent(ev);
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Hand-off: write the instruction to .lore/next-prompt.md and get a pointer
  // line to paste into the user's own Claude Code session.
  const handoff = useCallback(
    ({ changes, context, projectName }) =>
      wrap(() => post('/api/build/handoff', { changes, context, projectName })),
    [wrap]
  );

  return { loading, error, generatePlan, structureDump, runScan, runDeepScan, runSync, compile, build, buildStream, handoff };
}
