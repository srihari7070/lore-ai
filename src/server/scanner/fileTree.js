import { glob } from 'glob';
import fs from 'node:fs';
import path from 'node:path';

const ALWAYS_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.cache/**',
  '**/*.lock',
  '**/.DS_Store',
];

/** Read .gitignore into glob-compatible ignore patterns (best-effort). */
function readGitignore(root) {
  const file = path.join(root, '.gitignore');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const clean = l.replace(/^\//, '').replace(/\/$/, '');
      return clean.includes('*') ? clean : `**/${clean}/**`;
    });
}

/**
 * Crawl the project directory and return the file list plus a compact tree
 * string suitable for feeding to Claude.
 */
export async function crawlFileTree(root) {
  const ignore = [...ALWAYS_IGNORE, ...readGitignore(root)];
  const files = await glob('**/*', {
    cwd: root,
    nodir: true,
    dot: false,
    ignore,
    follow: false,
  });

  const sorted = files.sort();
  const byExt = {};
  for (const f of sorted) {
    const ext = path.extname(f) || '(none)';
    byExt[ext] = (byExt[ext] || 0) + 1;
  }

  return {
    fileCount: sorted.length,
    files: sorted.slice(0, 2000), // cap to keep the AI payload sane
    extensions: byExt,
    tree: renderTree(sorted),
  };
}

/** Render a directory tree as indented text, depth-limited for readability. */
function renderTree(files, maxDepth = 4) {
  const root = {};
  for (const file of files) {
    const parts = file.split(/[\\/]/);
    let node = root;
    for (const part of parts) {
      node[part] = node[part] || {};
      node = node[part];
    }
  }

  const lines = [];
  const walk = (node, prefix, depth) => {
    if (depth > maxDepth) return;
    const keys = Object.keys(node).sort();
    for (const key of keys) {
      lines.push(`${prefix}${key}`);
      if (Object.keys(node[key]).length) walk(node[key], `${prefix}  `, depth + 1);
    }
  };
  walk(root, '', 0);
  return lines.slice(0, 600).join('\n');
}
