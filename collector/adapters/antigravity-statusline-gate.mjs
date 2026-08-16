const SCHEMA_VERSION = 'antigravity-statusline-fingerprint-v1';

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function visit(value, path, output) {
  const type = typeOf(value);
  output.add(`${path}:${type}`);
  if (Array.isArray(value)) {
    for (const item of value) visit(item, `${path}[]`, output);
    return;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value).sort()) visit(value[key], path ? `${path}.${key}` : key, output);
  }
}

export function summarizeAntigravityStatusLine(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new TypeError('Antigravity status line must be an object');
  const paths = new Set();
  for (const key of Object.keys(input).sort()) visit(input[key], key, paths);
  return { schemaVersion: SCHEMA_VERSION, paths: [...paths].sort() };
}
