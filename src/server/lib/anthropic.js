import { query } from '@anthropic-ai/claude-agent-sdk';

// All reasoning calls (scan / deep-scan / plan / compile / sync) go through the
// Claude Agent SDK — the SAME path as the builder — so they honor the user's
// Claude subscription (claude /login) and fall back to ANTHROPIC_API_KEY only
// if it's set. This is what makes "bring your own Claude, no API key needed"
// true for the whole tool, not just the build step.

function model() {
  return process.env.LORE_MODEL || 'claude-opus-4-8';
}

/** Strip ```json fences and parse, tolerating any prose Claude wraps around it. */
function parseJSON(text) {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const start = cleaned.search(/[{[]/);
    if (start >= 0) cleaned = cleaned.slice(start);
  }
  return JSON.parse(cleaned);
}

/**
 * Run a single-turn, tool-free generation through the Agent SDK and return the
 * final text. No tools + maxTurns:1 = pure generation (no file access), so this
 * behaves like a plain model call but with subscription-or-key auth.
 */
async function runQuery(system, user, { model: modelOverride } = {}) {
  const stream = query({
    prompt: user,
    options: {
      model: modelOverride || model(),
      systemPrompt: system, // custom system prompt (string), not the claude_code preset
      allowedTools: [], // pure generation — no file/bash tools
      maxTurns: 1,
      settingSources: [], // don't load the project's CLAUDE.md into reasoning calls
    },
  });

  let text = '';
  for await (const message of stream) {
    if (message.type === 'result') {
      if (message.subtype && message.subtype !== 'success') {
        throw new Error(`Claude returned: ${message.subtype}`);
      }
      text = message.result ?? '';
    }
  }
  return text.trim();
}

/**
 * Ask Claude and parse a JSON response.
 * @param {object} [opts]
 * @param {string} [opts.model]
 */
export async function askClaudeJSON(system, user, { model: modelOverride } = {}) {
  const text = await runQuery(
    `${system}\n\nRespond with ONLY valid JSON. No prose, no markdown fences.`,
    user,
    { model: modelOverride }
  );
  try {
    return parseJSON(text);
  } catch (err) {
    const e = new Error(`Claude returned unparseable JSON: ${err.message}`);
    e.raw = text;
    throw e;
  }
}

/** Ask Claude for plain text (used by the lore.md compiler). */
export async function askClaudeText(system, user, { model: modelOverride } = {}) {
  return runQuery(system, user, { model: modelOverride });
}
