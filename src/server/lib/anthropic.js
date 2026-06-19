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
export async function runQuery(system, user, { model: modelOverride } = {}) {
  const stream = query({
    prompt: user,
    options: {
      model: modelOverride || model(),
      systemPrompt: system, // custom system prompt (string), not the claude_code preset
      allowedTools: [], // pure generation — no file/bash tools (no tool loops)
      // Large outputs (e.g. the deep-scan graph) can span multiple turns when a
      // turn hits the output-token limit; give it room to finish. With no tools,
      // extra turns only ever continue the generation.
      maxTurns: 24,
      settingSources: [], // don't load the project's CLAUDE.md into reasoning calls
    },
  });

  // Accumulate the model's text as it streams, and also capture the final
  // success result. Preferring the success result when present, but falling
  // back to the accumulated text means a turn-cap stop still yields output
  // instead of a hard crash.
  let assistantText = '';
  let resultText = null;
  let errorSubtype = null;
  for await (const message of stream) {
    if (message.type === 'assistant') {
      for (const block of message.message?.content || []) {
        if (block.type === 'text') assistantText += block.text;
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') resultText = message.result ?? '';
      else errorSubtype = message.subtype;
    }
  }

  const text = (resultText ?? assistantText).trim();
  if (!text) {
    throw new Error(`Claude returned no usable output${errorSubtype ? ` (${errorSubtype})` : ''}`);
  }
  return text;
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
