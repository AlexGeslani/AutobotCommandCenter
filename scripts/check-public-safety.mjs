import { readdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const root = resolve(import.meta.dirname, '..');
const execFileAsync = promisify(execFile);
const excludedDirectories = new Set(['.git', 'node_modules', 'artifacts', 'test-results', 'playwright-report', '.ops']);
const excludedFiles = new Set([
  '.git',
  'standalone/public/data/provider-usage.v1.json',
  '.hermes/plugins/autobot-command-center/dashboard/dist/data/provider-usage.v1.json',
]);
// Owner-authorized private UI label; only these presentation artifacts may contain it.
const authorizedUiLabel = ['Tele', 'traan1'].join('');
const authorizedUiLabelFiles = new Set([
  'src/theme.mjs',
  '.hermes/plugins/autobot-command-center/dashboard/dist/index.js',
  'standalone/public/app.js',
]);
const privateInfrastructureIdentifiers = [
  ['The', 'Ark', 'Lab'].join(''),
  ['The', 'Ark'].join(' '),
  ['The', 'Ark', 'Lab'].join(' '),
  ['Tele', 'traan'].join(''),
  ['Vector', 'Sigma'].join(' '),
  ['Vector', 'Sigma'].join('-'),
  ['qmd', 'lan'].join('.'),
];
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const privateInfrastructurePattern = new RegExp(privateInfrastructureIdentifiers.map(escapeRegExp).join('|'), 'i');
const rules = [
  ['private IPv4 address', /(?<!\d)(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?!\d)/],
  ['macOS user path', /\/Users\/[^/\s"']+/],
  ['private LAN hostname', /\b[a-z0-9.-]+\.lan\b/i],
  ['private infrastructure name', privateInfrastructurePattern],
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
let candidateFiles;
try {
  const { stdout } = await execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
  candidateFiles = stdout.toString('utf8').split('\0').filter(Boolean).map((name) => resolve(root, name));
} catch {
  candidateFiles = await filesUnder(root);
}

for (const path of candidateFiles) {
  const name = relative(root, path).replaceAll('\\', '/');
  if (excludedFiles.has(name)) continue;
  const bytes = await readFile(path);
  if (bytes.includes(0)) continue;
  const rawText = bytes.toString('utf8');
  const text = authorizedUiLabelFiles.has(name) ? rawText.replaceAll(authorizedUiLabel, '') : rawText;
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
