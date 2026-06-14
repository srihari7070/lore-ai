import fs from 'node:fs';
import path from 'node:path';

/** Read package.json dependencies, scripts, and metadata if present. */
export function readDependencies(root) {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { hasPackageJson: false };
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return { hasPackageJson: true, parseError: true };
  }

  return {
    hasPackageJson: true,
    name: pkg.name,
    description: pkg.description,
    type: pkg.type,
    scripts: pkg.scripts || {},
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
  };
}

/** Look for Python project markers and read their declared dependencies. */
export function readPythonDependencies(root) {
  const result = {};
  const req = path.join(root, 'requirements.txt');
  if (fs.existsSync(req)) {
    result.requirements = fs
      .readFileSync(req, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .slice(0, 200);
  }
  const pyproject = path.join(root, 'pyproject.toml');
  if (fs.existsSync(pyproject)) {
    result.pyproject = true;
  }
  return Object.keys(result).length ? result : null;
}
