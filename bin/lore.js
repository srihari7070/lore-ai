#!/usr/bin/env node
import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import open from 'open';
import dotenv from 'dotenv';
import { startServer } from '../src/server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const projectRoot = process.cwd();

// Read the version from package.json so it can never drift out of sync again.
const pkgVersion = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;

// Load any existing .env from the project the user is working in.
dotenv.config({ path: path.join(projectRoot, '.env') });

const program = new Command();

program
  .name('lore')
  .description('Visual architecture planning and scanning for AI-assisted development')
  .version(pkgVersion);

async function ensureAuth() {
  // Subscription-first: Lore runs on your Claude plan via the Agent SDK
  // (claude /login). An API key is only a fallback. So we never *block* on a
  // key — if one is set we use it; otherwise we use the subscription.
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('\n  Using ANTHROPIC_API_KEY (pay-as-you-go).');
    return;
  }
  console.log(
    '\n  No ANTHROPIC_API_KEY set — using your Claude subscription.' +
      '\n  (If Claude isn\'t logged in, run `claude /login` first.' +
      '\n   To use an API key instead, set ANTHROPIC_API_KEY.)'
  );
}

async function run(mode, options) {
  await ensureAuth();

  const port = Number(process.env.LORE_PORT) || 3333;
  const url = `http://localhost:${port}`;

  const server = await startServer({
    port,
    mode,
    projectRoot,
    packageRoot,
    dev: Boolean(options.dev),
  });

  console.log(`\n  Lore Map is running in ${mode} mode`);
  console.log(`  → ${url}\n`);

  if (options.open !== false && !options.dev) {
    await open(url);
  }

  const shutdown = () => {
    console.log('\n  Shutting down Lore Map.');
    server.close(() => process.exit(0));
    // Force-exit if connections linger.
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

program
  .command('init')
  .description('Start a new Lore project in Plan mode')
  .option('--no-open', 'do not auto-open the browser')
  .option('--dev', 'run the API only (Vite serves the client)')
  .action((options) => run('plan', options));

program
  .command('open')
  .description('Open the Lore UI for the current project')
  .option('--no-open', 'do not auto-open the browser')
  .option('--dev', 'run the API only (Vite serves the client)')
  .action((options) => {
    // If a lore.md already exists we still land in plan mode; the UI loads it.
    run('plan', options);
  });

program
  .command('scan')
  .description('Scan an existing codebase into a high-level node graph')
  .option('--no-open', 'do not auto-open the browser')
  .option('--dev', 'run the API only (Vite serves the client)')
  .action((options) => run('scan', options));

program
  .command('deep-scan')
  .alias('deep')
  .description('Deep scan: map DB tables/fields/relations and code structure into the drill-down graph')
  .option('--no-open', 'do not auto-open the browser')
  .option('--dev', 'run the API only (Vite serves the client)')
  .action((options) => run('deep', options));

program
  .command('sync')
  .description('Sync lore.md against the current codebase state')
  .option('--no-open', 'do not auto-open the browser')
  .option('--dev', 'run the API only (Vite serves the client)')
  .action((options) => run('sync', options));

program.parseAsync(process.argv);
