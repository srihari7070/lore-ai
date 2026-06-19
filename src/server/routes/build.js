import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { runBuild, getAuthMode, SCOPING_NOTE } from '../lib/builder.js';
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

// Turn an Agent SDK message into a short human action for the progress feed.
export function describeActivity(message) {
  if (message.type !== 'assistant') return null;
  const blocks = message.message?.content || [];
  for (const b of blocks) {
    if (b.type === 'tool_use') {
      const target = b.input?.file_path || b.input?.path || b.input?.command || b.input?.pattern || '';
      const verb =
        { Edit: 'Editing', Write: 'Writing', Read: 'Reading', Bash: 'Running', Grep: 'Searching', Glob: 'Finding' }[b.name] ||
        b.name;
      return `${verb} ${String(target).slice(0, 60)}`.trim();
    }
  }
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
  return text ? text.slice(0, 80) : null;
}

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

  // Streaming build: same as POST / but emits Server-Sent Events so the UI can
  // show a live progress bar + the actual actions as they happen.
  router.post('/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
      const { instruction, changes, context, projectName, model } = req.body;
      let finalInstruction = instruction;
      if (!finalInstruction || !finalInstruction.trim()) {
        if (!changes) {
          send({ type: 'error', error: 'Provide either `instruction` or staged `changes`.' });
          return res.end();
        }
        send({ type: 'status', phase: 'interpreting', label: 'Understanding your changes…' });
        finalInstruction = await interpretIntent({ changes, context, projectName });
      }
      send({ type: 'status', phase: 'building', label: 'Building…', instruction: finalInstruction });

      const result = await runBuild({
        instruction: finalInstruction,
        projectRoot: ctx.projectRoot,
        model: BUILDER_MODELS.has(model) ? model : undefined,
        onEvent: (m) => {
          const action = describeActivity(m);
          if (action) send({ type: 'activity', action });
        },
      });

      send({ type: 'done', result: { ...result, instruction: finalInstruction, authMode: getAuthMode() } });
    } catch (err) {
      console.error(err);
      send({ type: 'error', error: err.message });
    }
    res.end();
  });

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
        `${finalInstruction}\n${SCOPING_NOTE}\n`;
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
