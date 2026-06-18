import fs from 'node:fs';
import path from 'node:path';

// Source file extensions across many languages. The AI reads these directly,
// so we don't need a per-language parser — just sensible selection + budgeting.
const SOURCE_EXTS = new Set([
  // JS/TS
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte',
  // Python
  '.py',
  // JVM
  '.java', '.kt', '.kts', '.scala', '.groovy',
  // .NET
  '.cs', '.fs',
  // systems
  '.go', '.rs', '.c', '.cc', '.cpp', '.h', '.hpp', '.swift',
  // scripting / other
  '.rb', '.php', '.ex', '.exs', '.dart', '.lua', '.r', '.jl', '.sh',
  // data / schema / markup
  '.sql', '.prisma', '.graphql', '.gql', '.proto', '.sol',
  '.html', '.css', '.scss',
]);

// Files that most define a project's structure — read these first.
const PRIORITY_RE = /(schema|models?|entit|migration|route|controller|resolver|main|app|index|server|api|db|database|store|service)/i;

const SKIP_RE = /(\.min\.|\.map$|\.lock$|-lock\.|\.d\.ts$)/i;

/**
 * Collect source file contents for the AI to read, bounded by a char budget so
 * large repos stay affordable. Prioritizes structure-defining files, truncates
 * very large files, and reports what was included/omitted.
 *
 * @param {string}   root
 * @param {string[]} files            project-relative file list (from crawlFileTree)
 * @param {object}   [opts]
 * @param {number}   [opts.totalBudget=80000]  total chars of source to include
 * @param {number}   [opts.maxFileChars=4000]  per-file cap (truncated beyond)
 * @param {number}   [opts.maxFiles=80]        max number of files to include
 */
export function gatherSources(root, files, { totalBudget = 80000, maxFileChars = 4000, maxFiles = 80 } = {}) {
  const candidates = files.filter(
    (f) => SOURCE_EXTS.has(path.extname(f).toLowerCase()) && !SKIP_RE.test(f)
  );

  // Priority files first, then the rest; smaller files first within each group
  // so we fit more breadth before the budget runs out.
  const sized = candidates.map((f) => {
    let size = 0;
    try {
      size = fs.statSync(path.join(root, f)).size;
    } catch {
      /* ignore */
    }
    return { file: f, size, priority: PRIORITY_RE.test(f) };
  });
  sized.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return a.size - b.size;
  });

  const parts = [];
  let used = 0;
  let included = 0;
  let truncatedFiles = 0;

  for (const { file } of sized) {
    if (used >= totalBudget || included >= maxFiles) break;
    let content;
    try {
      content = fs.readFileSync(path.join(root, file), 'utf8');
    } catch {
      continue;
    }
    let body = content;
    if (body.length > maxFileChars) {
      body = body.slice(0, maxFileChars) + '\n…[truncated]';
      truncatedFiles++;
    }
    const block = `// ===== FILE: ${file.split(path.sep).join('/')} =====\n${body}\n\n`;
    if (used + block.length > totalBudget) break;
    parts.push(block);
    used += block.length;
    included++;
  }

  return {
    text: parts.join(''),
    includedCount: included,
    totalCount: candidates.length,
    omittedCount: Math.max(0, candidates.length - included),
    truncatedFiles,
    bytes: used,
  };
}
