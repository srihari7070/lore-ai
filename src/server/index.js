import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createAIRouter } from './routes/ai.js';
import { createScanRouter } from './routes/scan.js';
import { createBlueprintRouter } from './routes/blueprint.js';
import { createBuildRouter } from './routes/build.js';
import { getAuthMode } from './lib/builder.js';

/**
 * Boots the local Lore AI server.
 *
 * @param {object} options
 * @param {number} options.port        Port to listen on.
 * @param {string} options.mode        'plan' | 'scan' | 'sync'.
 * @param {string} options.projectRoot The directory the user is working in.
 * @param {string} options.packageRoot The installed package root (for dist).
 * @param {boolean} options.dev        When true, skip serving the built client.
 * @returns {Promise<import('http').Server>}
 */
export function startServer({ port, mode, projectRoot, packageRoot, dev = false }) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Shared context every route can read.
  const ctx = { mode, projectRoot, packageRoot };

  // Tells the client which mode to boot into and where it's pointed.
  app.get('/api/config', (_req, res) => {
    res.json({
      mode,
      projectName: path.basename(projectRoot),
      projectRoot,
      hasBlueprint: fs.existsSync(path.join(projectRoot, 'lore.md')),
      hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
      model: process.env.LORE_MODEL || 'claude-opus-4-8',
      authMode: getAuthMode(), // 'api-key' | 'subscription'
      builderModels: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5'],
    });
  });

  app.use('/api/ai', createAIRouter(ctx));
  app.use('/api/scan', createScanRouter(ctx));
  app.use('/api/blueprint', createBlueprintRouter(ctx));
  app.use('/api/build', createBuildRouter(ctx));

  // Serve the built client in production. In --dev the Vite server handles this.
  if (!dev) {
    const clientDir = path.join(packageRoot, 'dist', 'client');
    if (!fs.existsSync(clientDir)) {
      console.error(
        '\n  Built client not found at dist/client. Run `npm run build` first ' +
          '(this is bundled automatically in the published package).\n'
      );
    } else {
      app.use(express.static(clientDir));
      // SPA fallback — every non-API route returns index.html.
      app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(clientDir, 'index.html'));
      });
    }
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.on('error', reject);
  });
}
