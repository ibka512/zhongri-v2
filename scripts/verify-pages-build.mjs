import { readFile } from 'node:fs/promises';
import { stdout } from 'node:process';
import { URL } from 'node:url';

const expectedBasePath = '/zhongri-v2/';
const [html, manifestText, serviceWorker] = await Promise.all([
  readFile(new URL('../dist/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'),
  readFile(new URL('../dist/sw.js', import.meta.url), 'utf8'),
]);
const manifest = JSON.parse(manifestText);

const checks = [
  {
    condition: html.includes(`${expectedBasePath}assets/`),
    message: 'index.html assets must use the GitHub Pages base path',
  },
  {
    condition: !html.includes('="/assets/'),
    message: 'index.html must not contain root-relative asset URLs',
  },
  {
    condition: manifest.start_url === expectedBasePath,
    message: 'PWA start_url must stay inside the repository path',
  },
  {
    condition: manifest.scope === expectedBasePath,
    message: 'PWA scope must stay inside the repository path',
  },
  {
    condition: serviceWorker.includes(`${expectedBasePath}index.html`),
    message: 'service worker navigation fallback must use the repository path',
  },
];
const failedChecks = checks.filter((check) => !check.condition);

if (failedChecks.length > 0) {
  throw new Error(
    `GitHub Pages artifact verification failed:\n${failedChecks
      .map((check) => `- ${check.message}`)
      .join('\n')}`,
  );
}

stdout.write(`Verified GitHub Pages artifact at ${expectedBasePath}\n`);
