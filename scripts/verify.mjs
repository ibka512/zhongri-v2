import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const checks = [
  ['verify:canonical'],
  ['verify:docs'],
  ['format:check'],
  ['lint'],
  ['typecheck'],
  ['test'],
  ['build'],
  ['build:pages'],
];

for (const [script] of checks) {
  console.log(`\n=== npm run ${script} ===`);
  const result = spawnSync(npmCommand, ['run', script], { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nAll project checks passed.');
