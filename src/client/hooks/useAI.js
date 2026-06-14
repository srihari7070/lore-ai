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

  return { loading, error, generatePlan, structureDump, runScan, runDeepScan, runSync, compile, build };
}
