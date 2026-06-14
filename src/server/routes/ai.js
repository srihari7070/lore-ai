import { Router } from 'express';
import { askClaudeJSON } from '../lib/anthropic.js';

// Small wrapper so route handlers can throw and get a clean 500 with the message.
function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message, raw: err.raw });
    }
  };
}

export function createAIRouter() {
  const router = Router();

  // Plan mode: turn a free-text project description into root nodes + the
  // minimum decisions the AI needs answered before it can compile.
  router.post(
    '/plan',
    handle(async (req, res) => {
      const { description } = req.body;
      if (!description || !description.trim()) {
        return res.status(400).json({ error: 'A project description is required.' });
      }

      const system = [
        'You are the planning engine for Lore AI, an architecture planning tool.',
        'Given a project description, produce the MINIMUM required architecture as 4-6 root nodes.',
        'Do not invent product features or opinions — only structural architecture nodes.',
        'Also produce a short list of minimum required decisions the user must answer before the architecture is complete.',
        '',
        'Output JSON shaped exactly as:',
        '{',
        '  "summary": "1-2 sentence neutral restatement of the project",',
        '  "nodes": [{ "title": "Backend", "type": "core|custom|integration", "rationale": "one line" }],',
        '  "decisions": ["Do you need user authentication?", "Will this have a mobile app?"]',
        '}',
      ].join('\n');

      const data = await askClaudeJSON(system, `Project description:\n${description}`);
      res.json(data);
    })
  );

  // Structuring AI (passive): organize a node's free-text dump into sub-nodes.
  // It must NOT add ideas of its own — only structure what the user wrote.
  router.post(
    '/structure',
    handle(async (req, res) => {
      const { dump, nodeTitle } = req.body;
      if (!dump || !dump.trim()) {
        return res.status(400).json({ error: 'Dump text is required.' });
      }

      const system = [
        'You are the structuring engine for Lore AI.',
        'Organize the user\'s raw notes into sub-nodes. This is a PASSIVE role:',
        'do NOT add opinions, suggestions, features, or ideas the user did not write.',
        'Only organize and label what is already present in the notes.',
        'If the notes contain nothing structurable, return an empty sub-node list.',
        '',
        'Output JSON shaped exactly as:',
        '{ "subNodes": [{ "title": "short label", "summary": "1-2 lines drawn only from the notes" }] }',
      ].join('\n');

      const user = `Node: ${nodeTitle || 'Untitled'}\n\nRaw notes:\n${dump}`;
      const data = await askClaudeJSON(system, user);
      res.json(data);
    })
  );

  return router;
}
