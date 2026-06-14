#!/usr/bin/env node
import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import open from 'open';
import dotenv from 'dotenv';
import { startServer } from '../src/server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const projectRoot = process.cwd();

// Load any existing .env from the project the user is working in.
dotenv.config({ path: path.join(projectRoot, '.env') });

const program = new Command();

program
  .name('lore-ai')
  .description('Visual architecture planning and scanning for AI-assisted development')
  .version('0.1.0');

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (hidden) {
      // Mute echo so the API key isn't printed to the terminal: write the
      // prompt once, then swallow all subsequent output until the answer.
      let muted = false;
      const original = rl._writeToOutput.bind(rl);
      rl._writeToOutput = (str) => {
        if (muted) return;
        original(str);
        if (str.includes(question)) muted = true;
      };
      rl.question(question, (answer) => {
        rl.output.write('\n');
        rl.close();
        resolve(answer.trim());
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function ensureApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return;

  console.log('\n  Lore AI needs your Anthropic API key (brought by you — nothing runs on our servers).');
  console.log('  Get one at https://console.anthropic.com/settings/keys\n');

  const key = await ask('  Paste your ANTHROPIC_API_KEY: ', { hidden: true });
  if (!key) {
    console.error('\n  No key provided. Exiting.');
    process.exit(1);
  }

  const envPath = path.join(projectRoot, '.env');
  let existing = '';
  try {
    existing = fs.readFileSync(envPath, 'utf8');
  } catch {
    /* no existing .env */
  }
  if (!/^ANTHROPIC_API_KEY=/m.test(existing)) {
    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(envPath, `${prefix}ANTHROPIC_API_KEY=${key}\n`);
    console.log(`  Saved to ${path.relative(projectRoot, envPath) || '.env'}\n`);
  }
  process.env.ANTHROPIC_API_KEY = key;
}

async function run(mode, options) {
  await ensureApiKey();

  const port = Number(process.env.LORE_PORT) || 3333;
  const url = `http://localhost:${port}`;

  const server = await startServer({
    port,
    mode,
    projectRoot,
    packageRoot,
    dev: Boolean(options.dev),
  });

  console.log(`\n  Lore AI is running in ${mode} mode`);
  console.log(`  → ${url}\n`);

  if (options.open !== false && !options.dev) {
    await open(url);
  }

  const shutdown = () => {
    console.log('\n  Shutting down Lore AI.');
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
