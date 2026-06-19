import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { runBuild, getAuthMode } from '../lib/builder.js';
import { interpretIntent } from '../lib/interpreter.js';

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };
}

// Allowed builder models (user-selectable in the UI).
const BUILDER_MODELS = new Set([
  'claude-haiku-4-5',
  'claude-sonnet-4-6',
  'claude-opus-4-8',
]);

export function createBuildRouter(ctx) {
  const router = Router();

  // The "commit" target. Two ways to call it:
  //   { instruction }                  → build directly from a ready instruction
  //   { changes, context, projectName} → interpreter (Haiku) turns staged UI
  //                                        intent into the instruction first
  // The builder model is user-selectable; the interpreter is always Haiku.
  router.post(
    '/',
    handle(async (req, res) => {
      const { instruction, changes, context, projectName, model } = req.body;
      const chosen = BUILDER_MODELS.has(model) ? model : undefined;

      let finalInstruction = instruction;
      let interpreted = false;
      if (!finalInstruction || !finalInstruction.trim()) {
        if (!changes) {
          return res.status(400).json({ error: 'Provide either `instruction` or staged `changes`.' });
        }
        finalInstruction = await interpretIntent({ changes, context, projectName });
        interpreted = true;
      }

      const result = await runBuild({
        instruction: finalInstruction,
        projectRoot: ctx.projectRoot,
        model: chosen,
      });
      res.json({ ...result, instruction: finalInstruction, interpreted, authMode: getAuthMode() });
    })
  );

  // Hand-off target: instead of building in the background, write the
  // interpreter's instruction to .lore/next-prompt.md and return a short
  // "pointer" the user copies into their OWN Claude Code session. The CLI reads
  // the file and does the work visibly — no background agent, no live-session injection.
  router.post(
    '/handoff',
    handle(async (req, res) => {
      const { instruction, changes, context, projectName } = req.body;
      let finalInstruction = instruction;
      if (!finalInstruction || !finalInstruction.trim()) {
        if (!changes) {
          return res.status(400).json({ error: 'Provide either `instruction` or staged `changes`.' });
        }
        finalInstruction = await interpretIntent({ changes, context, projectName });
      }

      const loreDir = path.join(ctx.projectRoot, '.lore');
      fs.mkdirSync(loreDir, { recursive: true });
      const file = path.join(loreDir, 'next-prompt.md');
      const doc =
        `# Lore — build instruction\n` +
        `Generated: ${new Date().toISOString()}\n\n` +
        `${finalInstruction}\n`;
      fs.writeFileSync(file, doc, 'utf8');

      const rel = path.relative(ctx.projectRoot, file).split(path.sep).join('/');
      // The one line the user pastes into their Claude Code session:
      const pointer =
        `Read the file \`${rel}\` in this project and implement the change it describes. ` +
        `It's a build instruction Lore generated from my architecture-map edits — follow it, then delete the file.`;

      res.json({ ok: true, path: rel, pointer, instruction: finalInstruction });
    })
  );

  return router;
}
