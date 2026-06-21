import { askClaudeText } from './anthropic.js';

// Small, cheap model — the interpreter's job is narrow: understand intent and
// write a clean instruction. It does not write code.
const INTERPRETER_MODEL = process.env.LORE_INTERPRETER_MODEL || 'claude-haiku-4-5';

const SYSTEM = [
  'You are the interpreter layer of Lore Map. A user edits a visual map of their',
  'project, then asks to apply that edit. Your ONLY job is to turn the edit into',
  'ONE short, clear instruction telling a coding agent what to change and where.',
  '',
  'Keep it minimal and safe:',
  '- Describe ONLY the specific change the user made — nothing more.',
  '- The project already exists and works. Never re-architect, re-scaffold, reset,',
  '  re-initialize, or rebuild code that is not part of this change.',
  '- If the context makes the target file(s) or area clear, name them. If not, just',
  '  describe the change plainly and let the coding agent find the right files itself.',
  '- Say WHAT to change and WHERE — do not write the code or list step-by-step edits.',
  '- Do not ask questions; resolve what the user implied.',
  '- Output plain prose. No preamble, no markdown headers, no code fences.',
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

  const instruction = await askClaudeText(SYSTEM, user, { model: INTERPRETER_MODEL });
  return instruction.trim();
}
