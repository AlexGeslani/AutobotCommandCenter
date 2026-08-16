import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const excludedDirectories = new Set(['.git', 'node_modules', 'artifacts', 'test-results', 'playwright-report', '.ops']);
const excludedFiles = new Set([
  '.git',
  'scripts/check-public-safety.mjs',
  'standalone/public/data/provider-usage.v1.json',
  '.hermes/plugins/autobot-command-center/dashboard/dist/data/provider-usage.v1.json',
]);
const rules = [
  ['private IPv4 address', /(?<!\d)(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?!\d)/],
  ['macOS user path', /\/Users\/[^/\s"']+/],
  ['private LAN hostname', /\b[a-z0-9.-]+\.lan\b/i],
  ['private infrastructure name', /TheArkLab|Teletraan|Vector[- ]Sigma|qmd\.lan/i],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\bgh[opsu]_[A-Za-z0-9]{20,}\b/],
  ['OpenAI-style secret', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/],
];

async function filesUnder(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) results.push(...await filesUnder(path));
    else if (entry.isFile()) results.push(path);
  }
  return results;
}

const findings = [];
for (const path of await filesUnder(root)) {
  const name = relative(root, path).replaceAll('\\', '/');
  if (excludedFiles.has(name)) continue;
  const bytes = await readFile(path);
  if (bytes.includes(0)) continue;
  const text = bytes.toString('utf8');
  for (const [label, pattern] of rules) {
    if (pattern.test(text)) findings.push(`${name}: ${label}`);
  }
}

if (findings.length) {
  console.error('Public-safety scan failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log('Public-safety scan passed: no private infrastructure or common secret patterns found.');
