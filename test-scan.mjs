// Quick test: run deep scan on multiple local projects and print top-level nodes.
// Usage: node test-scan.mjs
// Requires Claude subscription login (claude /login) or ANTHROPIC_API_KEY.

import { gatherScan, summarize } from './src/server/routes/scan.js';
import { askClaudeJSON } from './src/server/lib/anthropic.js';
import { extractDbSchema } from './src/server/scanner/dbSchema.js';
import { gatherSources } from './src/server/scanner/sources.js';

const PROJECTS = [
  'D:/Work/My own projects/Let AI Guess the Word',
  'D:/Work/My own projects/Healthy Brain Rot projects',
  'D:/Work/My own projects/Solo leveling',
];

const TOP_LEVEL_TITLES = ['Frontend', 'Backend', 'Database', 'Auth', 'Integrations', 'Infrastructure', 'CLI'];

const GRAPH_DEEP_SYSTEM = [
  'You are the deep reverse-engineering engine for Lore Map.',
  'You receive a scan PLUS the actual source code. Produce a NESTED graph: fixed top-level blocks with real internals as children.',
  '',
  'STRICT RULE — top-level node titles must be EXACTLY one of:',
  TOP_LEVEL_TITLES.join(', '),
  'No other titles. No framework names in the title (put them in "stack"). 3-6 top-level nodes max.',
  'This rule ensures the map looks the same every time the user rescans.',
  '',
  'Rules for children (internals):',
  '- Database: one child per table/model (detailType "table"), notes = key fields. Edges = relations.',
  '- Backend/Frontend/other code: one child per key file or module (detailType "module"),',
  '  notes = its main responsibility in one phrase. Edges = imports/calls.',
  '- Base ONLY on actual code shown. Do not invent files, tables, or relations.',
  '- Max ~15 children per block; group minor files rather than listing every one.',
  '- Notes are one short phrase, not sentences.',
  '',
  'Output JSON shaped exactly as:',
  '{',
  '  "summary": "2-3 sentence plain description of what this project does",',
  '  "nodes": [{',
  '    "title": "Database", "type": "core", "detailType": "database", "stack": ["Postgres"],',
  '    "notes": "primary data store",',
  '    "children": {',
  '      "nodes": [{ "title": "User", "type": "custom", "detailType": "table", "notes": "id, email, created_at" }],',
  '      "edges": [{ "from": "User", "to": "Post", "label": "has many" }]',
  '    }',
  '  }],',
  '  "edges": [{ "from": "Backend", "to": "Database", "label": "reads/writes" }]',
  '}',
  'Output ONLY the JSON object.',
].join('\n');

function printGraph(graph, runLabel) {
  console.log(`\n  ${runLabel}`);
  console.log(`  Summary: ${graph.summary}`);
  const titles = [];
  for (const n of graph.nodes || []) {
    const valid = TOP_LEVEL_TITLES.includes(n.title);
    const flag = valid ? '✓' : '✗ INVALID';
    const children = n.children?.nodes || [];
    titles.push(n.title);
    console.log(`\n    ${flag}  ${n.title}  [${(n.stack || []).join(', ') || 'no stack'}]`);

    if (n.detailType === 'database' || n.title === 'Database') {
      // Show full table structure
      for (const c of children) {
        const fields = c.fields?.map(f => `${f.name}${f.type ? ':' + f.type : ''}${f.rel ? '→' + f.rel : ''}`).join(', ')
          || c.notes || '';
        console.log(`        📋 ${c.title}`);
        if (fields) console.log(`           ${fields}`);
      }
    } else {
      for (const c of children.slice(0, 6)) {
        console.log(`        · ${c.title} — ${c.notes || ''}`);
      }
      if (children.length > 6) console.log(`        · ... +${children.length - 6} more`);
    }
  }
  return titles.sort().join(', ');
}

async function scanProject(root) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`PROJECT: ${root.split('/').pop()}`);
  console.log(`${'═'.repeat(65)}`);

  // Gather source once, scan twice with the same input
  const scan = await gatherScan(root, { full: true });
  const db = await extractDbSchema(root);
  const sources = gatherSources(root, scan.tree.files);
  const input =
    summarize(scan) +
    `\n\n=== SOURCE FILES (${sources.includedCount}/${sources.totalCount}) ===\n` +
    sources.text;

  console.log(`  (files: ${sources.includedCount}/${sources.totalCount})`);

  const [g1, g2] = await Promise.all([
    askClaudeJSON(GRAPH_DEEP_SYSTEM, `Deep scan:\n${input}`, { maxTokens: 16000 }),
    askClaudeJSON(GRAPH_DEEP_SYSTEM, `Deep scan:\n${input}`, { maxTokens: 16000 }),
  ]);

  // Inject deterministic DB schema if present (same for both runs)
  for (const g of [g1, g2]) {
    if (db.tables.length) {
      const dbNode = (g.nodes || []).find(n => n.title === 'Database');
      if (dbNode) {
        dbNode.children = {
          nodes: db.tables.map(t => ({
            title: t.name,
            type: 'custom',
            detailType: 'table',
            fields: t.fields.map(f => ({ name: f.name, type: f.type, rel: f.refTable })),
            notes: t.fields.map(f => f.name).join(', '),
          })),
          edges: db.relations.map(r => ({ from: r.from, to: r.to, label: r.label })),
        };
      }
    }
  }

  const titles1 = printGraph(g1, 'Run 1');
  const titles2 = printGraph(g2, 'Run 2');

  console.log('\n  ── Consistency check ──');
  if (titles1 === titles2) {
    console.log(`  ✓ SAME top-level structure both runs: ${titles1}`);
  } else {
    console.log(`  ✗ DIFFERENT`);
    console.log(`    Run 1: ${titles1}`);
    console.log(`    Run 2: ${titles2}`);
  }
}

(async () => {
  for (const project of PROJECTS) {
    try {
      await scanProject(project);
    } catch (err) {
      console.error(`\nFailed: ${project.split('/').pop()}\n${err.message}`);
    }
  }
  console.log(`\n${'═'.repeat(65)}`);
  console.log('All done.');
})();
