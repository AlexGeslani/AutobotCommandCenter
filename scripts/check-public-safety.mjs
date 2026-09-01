import { readdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const root = resolve(import.meta.dirname, '..');
const execFileAsync = promisify(execFile);
const excludedDirectories = new Set(['.git', 'node_modules', 'artifacts', 'test-results', 'playwright-report', '.ops']);
const excludedFiles = new Set([
  '.git',
  '.public-safety.private.json',
  'standalone/public/data/provider-usage.v1.json',
  '.hermes/plugins/autobot-command-center/dashboard/dist/data/provider-usage.v1.json',
]);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parsePrivateLiterals(raw, source) {
  const value = JSON.parse(raw);
  const literals = Array.isArray(value) ? value : value?.literals;
  if (!Array.isArray(literals) || literals.some((item) => typeof item !== 'string' || item.length < 3)) {
    throw new TypeError(`${source} must contain an array of non-empty string literals`);
  }
  return literals;
}

async function loadPrivateLiterals() {
  const literals = [];
  const path = resolve(root, '.public-safety.private.json');
  try {
    literals.push(...parsePrivateLiterals(await readFile(path, 'utf8'), '.public-safety.private.json'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (process.env.ACC_PUBLIC_SAFETY_PRIVATE_LITERALS_JSON) {
    literals.push(...parsePrivateLiterals(process.env.ACC_PUBLIC_SAFETY_PRIVATE_LITERALS_JSON, 'ACC_PUBLIC_SAFETY_PRIVATE_LITERALS_JSON'));
  }
  return [...new Set(literals)];
}

const rules = [
  ['private IPv4 address', /(?<!\d)(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?!\d)/],
  ['macOS user path', /\/Users\/[^/\s"']+/],
  ['private LAN hostname', /\b[a-z0-9.-]+\.lan\b/i],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub token', /\bgh[opsu]_[A-Za-z0-9]{20,}\b/],
  ['OpenAI-style secret', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/],
  ['credentialed URL', /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s/:@]{1,80}:[^\s/@]{3,200}@/i],
];
const privateLiterals = await loadPrivateLiterals();
if (privateLiterals.length) {
  rules.push(['private infrastructure literal', new RegExp(privateLiterals.map(escapeRegExp).join('|'), 'i')]);
}

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
  if (excludedFiles.has(name) || name.split('/').some((segment) => excludedDirectories.has(segment))) continue;
  let bytes;
  try {
    bytes = await readFile(path);
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
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
