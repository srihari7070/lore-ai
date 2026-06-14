import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

// Deterministic, local extraction of database structure — tables, fields, and
// the relations between them. No AI: this is just parsing. Supports Prisma and
// basic SQL today; extensible to other ORMs.

export async function extractDbSchema(root) {
  const tables = [];
  const relations = [];

  // Prisma
  const prismaFiles = await glob('**/schema.prisma', {
    cwd: root,
    ignore: ['**/node_modules/**'],
    nodir: true,
  });
  for (const rel of prismaFiles) {
    parsePrisma(fs.readFileSync(path.join(root, rel), 'utf8'), tables, relations);
  }

  // SQL (CREATE TABLE …)
  const sqlFiles = await glob('**/*.sql', {
    cwd: root,
    ignore: ['**/node_modules/**'],
    nodir: true,
  });
  for (const rel of sqlFiles.slice(0, 20)) {
    parseSql(fs.readFileSync(path.join(root, rel), 'utf8'), tables, relations);
  }

  return { tables, relations, source: prismaFiles[0] || sqlFiles[0] || null };
}

function parsePrisma(text, tables, relations) {
  const modelNames = [...text.matchAll(/model\s+(\w+)\s*\{/g)].map((m) => m[1]);
  const modelSet = new Set(modelNames);

  const blockRe = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = blockRe.exec(text))) {
    const [, name, body] = m;
    const fields = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      const fieldName = parts[0];
      const rawType = parts[1];
      const baseType = rawType.replace(/[?[\]]/g, '');
      const isRelation = modelSet.has(baseType);
      fields.push({ name: fieldName, type: rawType, isRelation, refTable: isRelation ? baseType : null });
      if (isRelation) {
        relations.push({ from: name, to: baseType, label: fieldName });
      }
    }
    tables.push({ name, fields });
  }
}

function parseSql(text, tables, relations) {
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]*?)\);/gi;
  let m;
  while ((m = re.exec(text))) {
    const [, name, body] = m;
    const fields = [];
    for (const rawLine of body.split(',\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      const fkInline = line.match(/[`"]?(\w+)[`"]?[^,]*REFERENCES\s+[`"]?(\w+)[`"]?/i);
      const fkConstraint = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"]?(\w+)[`"]?/i);
      if (fkConstraint) {
        relations.push({ from: name, to: fkConstraint[2], label: fkConstraint[1].trim() });
        continue;
      }
      const col = line.match(/^[`"]?(\w+)[`"]?\s+([A-Za-z][\w()]*)/);
      if (col && !/^(PRIMARY|FOREIGN|CONSTRAINT|UNIQUE|KEY|INDEX|CHECK)$/i.test(col[1])) {
        const isRelation = Boolean(fkInline);
        fields.push({ name: col[1], type: col[2], isRelation, refTable: isRelation ? fkInline[2] : null });
        if (fkInline) relations.push({ from: name, to: fkInline[2], label: col[1] });
      }
    }
    tables.push({ name, fields });
  }
}
