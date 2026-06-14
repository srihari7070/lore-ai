import { parse } from '@babel/parser';
import fs from 'node:fs';
import path from 'node:path';

const JS_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

/**
 * Parse import/require graphs from JS/TS files. Returns a list of
 * { file, imports: [...] } and an aggregate count of external packages.
 */
export function parseImports(root, files) {
  const graph = [];
  const externalCounts = {};

  const jsFiles = files.filter((f) => JS_EXTS.has(path.extname(f))).slice(0, 400);

  for (const rel of jsFiles) {
    const abs = path.join(root, rel);
    let code;
    try {
      code = fs.readFileSync(abs, 'utf8');
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

    const imports = new Set();
    for (const node of ast.program.body) {
      if (node.type === 'ImportDeclaration') {
        imports.add(node.source.value);
      } else if (
        node.type === 'VariableDeclaration' ||
        node.type === 'ExpressionStatement'
      ) {
        // Catch top-level require('x') calls.
        const source = collectRequire(node);
        if (source) imports.add(source);
      }
    }

    for (const imp of imports) {
      if (!imp.startsWith('.') && !imp.startsWith('/')) {
        const pkg = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0];
        externalCounts[pkg] = (externalCounts[pkg] || 0) + 1;
      }
    }

    if (imports.size) {
      graph.push({ file: rel, imports: [...imports] });
    }
  }

  return { graph: graph.slice(0, 300), externalCounts };
}

function collectRequire(node) {
  try {
    const expr =
      node.type === 'ExpressionStatement'
        ? node.expression
        : node.declarations?.[0]?.init;
    if (
      expr &&
      expr.type === 'CallExpression' &&
      expr.callee.name === 'require' &&
      expr.arguments[0]?.type === 'StringLiteral'
    ) {
      return expr.arguments[0].value;
    }
  } catch {
    /* ignore */
  }
  return null;
}
