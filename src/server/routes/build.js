import { Router } from 'express';
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

  return router;
}
