import { parse } from '@babel/parser';
import fs from 'node:fs';
import path from 'node:path';

const JS_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

// Deterministic, local extraction of code structure: per-file classes,
// functions, and exports, plus the local import edges between files. No AI.

export function extractCodeStructure(root, files) {
  const jsFiles = files.filter((f) => JS_EXTS.has(path.extname(f))).slice(0, 600);
  const fileInfo = []; // { file, classes, functions, exports }
  const importEdges = []; // { from, to } both project-relative files

  for (const rawRel of jsFiles) {
    const rel = rawRel.split(path.sep).join('/'); // normalize to forward slashes
    let code;
    try {
      code = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        errorRecovery: true,
        plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
      });
    } catch {
      continue;
    }

    const classes = [];
    const functions = [];
    const exports = [];

    for (const node of ast.program.body) {
      collect(node, { classes, functions, exports });
      // Local import edges (relative paths only).
      if (node.type === 'ImportDeclaration' && node.source.value.startsWith('.')) {
        const target = resolveLocal(rel, node.source.value);
        if (target) importEdges.push({ from: rel, to: target });
      }
    }

    fileInfo.push({
      file: rel,
      module: topModule(rel),
      classes: classes.slice(0, 30),
      functions: functions.slice(0, 40),
      exports: exports.slice(0, 40),
    });
  }

  return { files: fileInfo, importEdges: importEdges.slice(0, 1000) };
}

function collect(node, acc, exported = false) {
  switch (node.type) {
    case 'ClassDeclaration':
      if (node.id) {
        const methods = (node.body?.body || [])
          .filter((m) => m.type === 'ClassMethod' && m.key?.name)
          .map((m) => m.key.name);
        acc.classes.push({ name: node.id.name, methods: methods.slice(0, 30) });
        if (exported) acc.exports.push(node.id.name);
      }
      break;
    case 'FunctionDeclaration':
      if (node.id) {
        acc.functions.push(node.id.name);
        if (exported) acc.exports.push(node.id.name);
      }
      break;
    case 'VariableDeclaration':
      for (const d of node.declarations) {
        if (d.id?.name && (d.init?.type === 'ArrowFunctionExpression' || d.init?.type === 'FunctionExpression')) {
          acc.functions.push(d.id.name);
          if (exported) acc.exports.push(d.id.name);
        }
      }
      break;
    case 'ExportNamedDeclaration':
      if (node.declaration) collect(node.declaration, acc, true);
      for (const s of node.specifiers || []) if (s.exported?.name) acc.exports.push(s.exported.name);
      break;
    case 'ExportDefaultDeclaration':
      acc.exports.push('default');
      if (node.declaration) collect(node.declaration, acc, false);
      break;
    default:
      break;
  }
}

// First two path segments → a "module" grouping (e.g. src/server, src/client/components).
function topModule(rel) {
  const parts = rel.split(/[\\/]/);
  return parts.slice(0, Math.min(2, parts.length - 1)).join('/') || '.';
}

// Best-effort resolve of a relative import to a project file path.
function resolveLocal(fromFile, spec) {
  const dir = path.posix.dirname(fromFile.split(path.sep).join('/'));
  let target = path.posix.normalize(path.posix.join(dir, spec));
  if (path.extname(target)) return target;
  // bare path — leave as-is; the AI/graph can match by prefix
  return target;
}
