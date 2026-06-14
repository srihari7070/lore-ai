import { askClaudeText } from './anthropic.js';

// Small, cheap model — the interpreter's job is narrow: understand intent and
// write a clean instruction. It does not write code.
const INTERPRETER_MODEL = process.env.LORE_INTERPRETER_MODEL || 'claude-haiku-4-5';

const SYSTEM = [
  'You are the interpreter layer of Lore AI, a low-code builder on top of the Claude Agent SDK.',
  'You receive: (a) the staged changes a user made in a visual node graph, and',
  '(b) the current architectural context (the project blueprint).',
  'Your ONLY job is to translate that into ONE clear, complete, build-ready instruction',
  'for a coding agent that will edit the project files.',
  '',
  'Rules:',
  '- Be concrete and unambiguous. Resolve what the user implied; do not ask questions.',
  '- Reference the stack/architecture from the context so the agent stays consistent.',
  '- Describe WHAT to build/change and WHERE, not step-by-step code.',
  '- Do not add scope the user did not ask for. Stay tight to the staged changes.',
  '- Output the instruction as plain prose. No preamble, no markdown headers, no code fences.',
].join('\n');

/**
 * Turn staged UI changes + context into a single build instruction.
 *
 * @param {object} args
 * @param {Array|string} args.changes      The staged graph diff / actions / notes.
 * @param {string}       args.context      Project blueprint / graph summary (lore.md-ish).
 * @param {string}       [args.projectName]
 * @returns {Promise<string>} a build-ready instruction
 */
export async function interpretIntent({ changes, context, projectName }) {
  const user = [
    projectName ? `Project: ${projectName}` : '',
    '',
    'Current architectural context:',
    context || '(none yet)',
    '',
    'Staged changes the user just made in the graph:',
    typeof changes === 'string' ? changes : JSON.stringify(changes, null, 2),
  ].join('\n');

  const instruction = await askClaudeText(SYSTEM, user, {
    model: INTERPRETER_MODEL,
    maxTokens: 2000,
  });
  return instruction.trim();
}
