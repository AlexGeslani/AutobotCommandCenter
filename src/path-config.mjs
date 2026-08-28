import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, resolve } from 'node:path';
import contract from '../config/paths.v1.json' with { type: 'json' };

export const ACC_PATH_SCHEMA_VERSION = 'acc-path-config-v1';

const ENV_KEYS = Object.freeze({
  hiveMindClient: 'HIVEMIND_CLIENT_PATH',
  hiveMindTokenFile: 'HIVEMIND_TOKEN_FILE',
  hiveMindTlsPinFile: 'HIVEMIND_TLS_PIN_FILE',
  providerUsagePrivateCacheDir: 'ACC_PROVIDER_USAGE_PRIVATE_DIR',
  braveHermesEnvFile: 'ACC_BRAVE_HERMES_ENV_FILE',
  showcaseSkillsRoot: 'HERMES_SKILLS_ROOT',
});

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateRelativeDefault(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} default must be a path string`);
  if (value.includes('\0') || isAbsolute(value) || value === '..' || value.startsWith('../')) {
    throw new TypeError(`${name} default must be a portable home-relative path`);
  }
}

export function validateAccPathContract(value) {
  if (!plainObject(value) || value.schemaVersion !== ACC_PATH_SCHEMA_VERSION || !plainObject(value.paths)) {
    throw new TypeError(`path contract must use ${ACC_PATH_SCHEMA_VERSION}`);
  }
  if (Object.keys(value).some((key) => !['schemaVersion', 'paths'].includes(key))) throw new TypeError('path contract has unknown field');
  const expected = Object.keys(ENV_KEYS).sort();
  if (Object.keys(value.paths).sort().join('\0') !== expected.join('\0')) throw new TypeError('path contract has an incomplete or unknown path set');
  for (const [name, spec] of Object.entries(value.paths)) {
    if (!plainObject(spec) || Object.keys(spec).some((key) => !['kind', 'required', 'default'].includes(key))) throw new TypeError(`${name} has an invalid path specification`);
    if (!['file', 'directory'].includes(spec.kind) || typeof spec.required !== 'boolean') throw new TypeError(`${name} has an invalid path type`);
    if (spec.default == null) {
      if (spec.required) throw new TypeError(`${name} required path must have a default`);
    } else {
      validateRelativeDefault(spec.default, name);
    }
  }
  return value;
}

function validateLocalConfig(value, names) {
  if (value == null) return {};
  if (!plainObject(value) || value.schemaVersion !== ACC_PATH_SCHEMA_VERSION || !plainObject(value.paths)) {
    throw new TypeError(`local path config must use ${ACC_PATH_SCHEMA_VERSION}`);
  }
  if (Object.keys(value).some((key) => !['schemaVersion', 'paths'].includes(key))) throw new TypeError('local path config has a non-path field');
  for (const [name, path] of Object.entries(value.paths)) {
    if (!names.has(name)) throw new TypeError(`unknown path ${name}`);
    if (typeof path !== 'string') throw new TypeError(`${name} must be a path string`);
  }
  return value.paths;
}

function validateOverrides(value, names) {
  if (value == null) return {};
  if (!plainObject(value)) throw new TypeError('path overrides must be an object');
  for (const [name, path] of Object.entries(value)) {
    if (!names.has(name)) throw new TypeError(`unknown path ${name}`);
    if (path != null && typeof path !== 'string') throw new TypeError(`${name} must be a path string`);
  }
  return value;
}

function portablePath(value, home, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty path string`);
  const trimmed = value.trim();
  if (trimmed.includes('\0')) throw new TypeError(`${name} contains an invalid path character`);
  if (trimmed === '~') return resolve(home);
  if (trimmed.startsWith('~/')) return resolve(home, trimmed.slice(2));
  if (isAbsolute(trimmed)) return normalize(trimmed);
  if (trimmed === '..' || trimmed.startsWith('../')) throw new TypeError(`${name} relative path cannot escape the configured home`);
  return resolve(home, trimmed);
}

export function resolveAccPathConfig({
  contract: inputContract = contract,
  localConfig = null,
  env = process.env,
  home = homedir(),
  overrides = {},
} = {}) {
  const checked = validateAccPathContract(inputContract);
  const names = new Set(Object.keys(checked.paths));
  const localPaths = validateLocalConfig(localConfig, names);
  const cliPaths = validateOverrides(overrides, names);
  return Object.freeze(Object.fromEntries(Object.entries(checked.paths).map(([name, spec]) => {
    const raw = localPaths[name] ?? cliPaths[name] ?? env?.[ENV_KEYS[name]] ?? spec.default;
    return [name, raw == null ? null : portablePath(raw, home, name)];
  })));
}

export async function loadAccPathConfig({
  contract: inputContract = contract,
  configPath = null,
  env = process.env,
  home = homedir(),
  overrides = {},
} = {}) {
  const selectedConfig = configPath ?? env?.ACC_PATH_CONFIG ?? null;
  const localConfig = selectedConfig
    ? JSON.parse(await readFile(portablePath(selectedConfig, home, 'pathConfig'), 'utf8'))
    : null;
  return resolveAccPathConfig({ contract: inputContract, localConfig, env, home, overrides });
}

export const DEFAULT_ACC_PATHS = resolveAccPathConfig();
export const pathInPrivateCache = (name, paths = DEFAULT_ACC_PATHS) => join(paths.providerUsagePrivateCacheDir, name);
