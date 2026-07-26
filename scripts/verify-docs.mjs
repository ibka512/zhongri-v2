import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const markdownFiles = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      markdownFiles.push(fullPath);
    }
  }
}

function isExternalTarget(target) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target);
}

function getRelativeTargets(markdown) {
  const targets = [];
  const linkPattern = /!??\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '');
    const target = rawTarget.split(/[?#]/, 1)[0];
    if (!target || target.startsWith('#') || isExternalTarget(target)) {
      continue;
    }
    targets.push(target);
  }
  return targets;
}

await walk(root);

const missing = [];
for (const file of markdownFiles) {
  const markdown = await readFile(file, 'utf8');
  for (const target of getRelativeTargets(markdown)) {
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    try {
      await stat(resolved);
    } catch {
      missing.push(`${path.relative(root, file)} -> ${target}`);
    }
  }
}

if (missing.length > 0) {
  console.error('Missing Markdown targets:');
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Verified ${markdownFiles.length} Markdown files and their relative targets.`);
}
