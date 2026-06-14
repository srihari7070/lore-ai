import fs from 'node:fs';
import path from 'node:path';

// Map of framework → detection signals (dependency names and/or marker files).
const SIGNATURES = [
  { name: 'Next.js', deps: ['next'], files: ['next.config.js', 'next.config.mjs', 'next.config.ts'] },
  { name: 'React', deps: ['react'] },
  { name: 'Vue', deps: ['vue'], files: ['vue.config.js'] },
  { name: 'Svelte', deps: ['svelte'], files: ['svelte.config.js'] },
  { name: 'Angular', deps: ['@angular/core'], files: ['angular.json'] },
  { name: 'Express', deps: ['express'] },
  { name: 'Fastify', deps: ['fastify'] },
  { name: 'NestJS', deps: ['@nestjs/core'] },
  { name: 'Vite', deps: ['vite'], files: ['vite.config.js', 'vite.config.ts'] },
  { name: 'Tailwind CSS', deps: ['tailwindcss'], files: ['tailwind.config.js', 'tailwind.config.ts'] },
  { name: 'Prisma', deps: ['prisma', '@prisma/client'], files: ['prisma/schema.prisma'] },
  { name: 'Drizzle ORM', deps: ['drizzle-orm'] },
  { name: 'Mongoose', deps: ['mongoose'] },
  { name: 'TypeORM', deps: ['typeorm'] },
  { name: 'Sequelize', deps: ['sequelize'] },
  { name: 'Django', files: ['manage.py'] },
  { name: 'Flask', deps: ['flask'] },
  { name: 'FastAPI', deps: ['fastapi'] },
  { name: 'Docker', files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'] },
];

/**
 * Detect frameworks, ORMs, and notable config files from dependencies and
 * marker files. Also surfaces likely DB/schema and env files for the AI.
 */
export function detectFrameworks(root, deps) {
  const allDeps = {
    ...(deps.dependencies || {}),
    ...(deps.devDependencies || {}),
  };
  const detected = [];

  for (const sig of SIGNATURES) {
    const byDep = (sig.deps || []).some((d) => d in allDeps);
    const byFile = (sig.files || []).some((f) => fs.existsSync(path.join(root, f)));
    if (byDep || byFile) detected.push(sig.name);
  }

  return {
    frameworks: [...new Set(detected)],
    schemaFiles: findSchemaFiles(root),
    envKeys: readEnvKeys(root),
  };
}

function findSchemaFiles(root) {
  const candidates = [
    'prisma/schema.prisma',
    'schema.sql',
    'db/schema.sql',
    'drizzle/schema.ts',
    'models.py',
  ];
  return candidates.filter((c) => fs.existsSync(path.join(root, c)));
}

/** Read env variable KEYS only — never values — from .env.example or .env. */
function readEnvKeys(root) {
  for (const file of ['.env.example', '.env']) {
    const p = path.join(root, file);
    if (fs.existsSync(p)) {
      return fs
        .readFileSync(p, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => l.split('=')[0])
        .slice(0, 100);
    }
  }
  return [];
}
