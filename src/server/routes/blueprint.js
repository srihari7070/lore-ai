import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { askClaudeText } from '../lib/anthropic.js';

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

const COMPILE_SYSTEM = [
  'You are the lore.md compiler for Lore Map.',
  'Given the full node graph (nodes, sub-nodes, stack choices, verbatim notes, connections, decisions, open questions),',
  'produce a single structured Markdown blueprint that an AI coding tool can read for deep project context.',
  'Preserve the user\'s verbatim notes exactly under each node — do not paraphrase or editorialize them.',
  'Use this exact section structure:',
  '',
  '# Lore — [Project Name]',
  'Generated: [timestamp]',
  'Mode: [Plan / Scan / Sync]',
  '',
  '## Project Summary',
  '## Architecture Map  (a text/ASCII representation of node connections)',
  '## Nodes  (### per node with Type, Stack, Status, #### Decisions, #### Notes, #### Sub-nodes, #### Connections)',
  '## Open Questions',
  '## Constraints  (hard stack choices Claude Code must respect)',
  '',
  'Output ONLY the Markdown document, no fences, no preamble.',
].join('\n');

export function createBlueprintRouter(ctx) {
  const router = Router();
  const lorePath = () => path.join(ctx.projectRoot, 'lore.md');

  // Read the existing blueprint, if any.
  router.get(
    '/',
    handle(async (_req, res) => {
      const p = lorePath();
      if (!fs.existsSync(p)) return res.json({ exists: false, content: null });
      res.json({ exists: true, content: fs.readFileSync(p, 'utf8') });
    })
  );

  // Compile the graph to lore.md and write it to the project root.
  router.post(
    '/compile',
    handle(async (req, res) => {
      const { graph, projectName } = req.body;
      if (!graph) return res.status(400).json({ error: 'A graph payload is required.' });

      const payload = {
        projectName: projectName || ctx.projectName || path.basename(ctx.projectRoot),
        mode: ctx.mode,
        timestamp: new Date().toISOString(),
        graph,
      };

      const markdown = await askClaudeText(
        COMPILE_SYSTEM,
        `Compile this graph into lore.md:\n${JSON.stringify(payload, null, 2)}`
      );

      const body = markdown.trim() + '\n';
      const p = lorePath();
      fs.writeFileSync(p, body, 'utf8');

      // Also emit CLAUDE.md so the Agent SDK builder auto-loads it as standing
      // context (via settingSources: ['project']). lore.md is the human-facing
      // blueprint; CLAUDE.md is the same intent, in the channel Claude reads.
      const claudePath = path.join(ctx.projectRoot, 'CLAUDE.md');
      const claudeBody =
        '<!-- Maintained by Lore Map. This is the architectural intent for the ' +
        'builder; edit the graph in Lore Map rather than by hand. -->\n\n' +
        body;
      fs.writeFileSync(claudePath, claudeBody, 'utf8');

      res.json({ ok: true, path: p, claudePath, content: body });
    })
  );

  return router;
}
