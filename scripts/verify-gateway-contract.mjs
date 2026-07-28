import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pwaRoot = process.cwd();
const gatewayRoot = resolve(
  process.env.ZHONGRI_GATEWAY_DIR ?? resolve(pwaRoot, '../zhongri-ai-gateway'),
);
const relativeFixturePath = 'contracts/ai-task-protocol-v1.json';

function readCanonicalFixture(root) {
  const path = resolve(root, relativeFixturePath);
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.request ||
    !parsed.success ||
    !parsed.failure
  ) {
    throw new Error(`Invalid AI Task Protocol fixture: ${path}`);
  }
  return { path, parsed };
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const pwaFixture = readCanonicalFixture(pwaRoot);
const gatewayFixture = readCanonicalFixture(gatewayRoot);
const pwaDigest = digest(pwaFixture.parsed);
const gatewayDigest = digest(gatewayFixture.parsed);

if (pwaDigest !== gatewayDigest) {
  throw new Error(
    `AI Task Protocol fixture drift detected:\nPWA ${pwaFixture.path}: ${pwaDigest}\nGateway ${gatewayFixture.path}: ${gatewayDigest}`,
  );
}

console.log(`Verified shared AI Task Protocol v1 fixture (${pwaDigest.slice(0, 12)}).`);
