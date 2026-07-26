import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const expected = {
  total: 9_828,
  languageCounts: { ja: 5_906, en: 3_922 },
  wordIdsSha256: '792f7baafd2be3eaa4f267d3090381fb2552a7390305a516e24602eae9745ac5',
  contentSha256: 'e1b2904c8fc695bf416f3130c527d9a2c4ac4b8f53a28ff35ec021f4e6a098df',
};

const assets = {
  ja: JSON.parse(await readFile(path.join(root, 'src/content/canonical/assets/ja.json'), 'utf8')),
  en: JSON.parse(await readFile(path.join(root, 'src/content/canonical/assets/en.json'), 'utf8')),
};
const words = [...assets.ja, ...assets.en];
const errors = [];
const identities = new Set();

function identityKey(word) {
  return `${word.language}:${word.id}`;
}

for (const word of words) {
  const identity = identityKey(word);
  if (identities.has(identity)) {
    errors.push(`duplicate identity ${identity}`);
  }
  identities.add(identity);

  if (!/^[a-z0-9][a-z0-9-]{2,127}$/.test(word.id)) {
    errors.push(`invalid id ${identity}`);
  }
  if (!['ja', 'en'].includes(word.language)) {
    errors.push(`invalid language ${identity}`);
  }
  for (const field of ['headword', 'partOfSpeech', 'meaning', 'level']) {
    if (typeof word[field] !== 'string' || word[field].trim().length === 0) {
      errors.push(`${identity} missing ${field}`);
    }
  }
  if (word.language === 'ja' && !word.reading) {
    errors.push(`${identity} missing Japanese reading`);
  }
  if (word.language === 'en' && !word.phonetic) {
    errors.push(`${identity} missing English phonetic`);
  }
  if (word.isBuiltIn !== true || !Number.isInteger(word.dataVersion) || word.dataVersion < 1) {
    errors.push(`${identity} has invalid built-in metadata`);
  }
  if (!Array.isArray(word.tags) || new Set(word.tags).size !== word.tags.length) {
    errors.push(`${identity} has invalid tags`);
  }
}

const actualLanguageCounts = {
  ja: assets.ja.length,
  en: assets.en.length,
};
if (words.length !== expected.total) {
  errors.push(`expected ${expected.total} words, got ${words.length}`);
}
for (const language of ['ja', 'en']) {
  if (actualLanguageCounts[language] !== expected.languageCounts[language]) {
    errors.push(
      `expected ${expected.languageCounts[language]} ${language} words, got ${actualLanguageCounts[language]}`,
    );
  }
}

const encoder = new TextEncoder();
const sha256 = async (text) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};
const sortedWords = [...words].sort((left, right) =>
  identityKey(left).localeCompare(identityKey(right)),
);
const actualWordIdsSha256 = await sha256(sortedWords.map(identityKey).join('\n'));
const actualContentSha256 = await sha256(JSON.stringify(sortedWords));
if (actualWordIdsSha256 !== expected.wordIdsSha256) {
  errors.push(`word ID digest drift: ${actualWordIdsSha256}`);
}
if (actualContentSha256 !== expected.contentSha256) {
  errors.push(`content digest drift: ${actualContentSha256}`);
}

if (errors.length > 0) {
  console.error('Canonical corpus verification failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Verified canonical corpus: ${words.length} words (${actualLanguageCounts.ja} ja, ${actualLanguageCounts.en} en)`,
);
