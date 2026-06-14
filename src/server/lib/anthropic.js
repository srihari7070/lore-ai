import Anthropic from '@anthropic-ai/sdk';

let client = null;

/** Lazily construct the Anthropic client from the user's own key. */
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function model() {
  return process.env.LORE_MODEL || 'claude-opus-4-8';
}

function extractText(message) {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** Strip ```json fences and parse, tolerating any prose Claude wraps around it. */
function parseJSON(text) {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  // Fall back to the first balanced object/array if there's leading prose.
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const start = cleaned.search(/[{[]/);
    if (start >= 0) cleaned = cleaned.slice(start);
  }
  return JSON.parse(cleaned);
}

/**
 * Ask Claude and parse a JSON response.
 *
 * @param {string} system    System prompt describing the role/output.
 * @param {string} user      User content.
 * @param {object} [opts]
 * @param {number} [opts.maxTokens=16000]
 */
export async function askClaudeJSON(system, user, { maxTokens = 16000, model: modelOverride } = {}) {
  // Stream and accumulate — avoids the SDK's non-streaming timeout guard on
  // large max_tokens (e.g. the deep-scan assembly) and is safe for any size.
  const stream = getClient().messages.stream({
    model: modelOverride || model(),
    max_tokens: maxTokens,
    system: `${system}\n\nRespond with ONLY valid JSON. No prose, no markdown fences.`,
    messages: [{ role: 'user', content: user }],
  });
  const message = await stream.finalMessage();
  const text = extractText(message);
  try {
    return parseJSON(text);
  } catch (err) {
    const e = new Error(`Claude returned unparseable JSON: ${err.message}`);
    e.raw = text;
    throw e;
  }
}

/** Ask Claude for plain text (used by the lore.md compiler). */
export async function askClaudeText(system, user, { maxTokens = 16000, model: modelOverride } = {}) {
  const stream = getClient().messages.stream({
    model: modelOverride || model(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const message = await stream.finalMessage();
  return extractText(message);
}
