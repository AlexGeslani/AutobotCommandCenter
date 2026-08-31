import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ACC_PATH_SCHEMA_VERSION,
  loadAccPathConfig,
  resolveAccPathConfig,
  validateAccPathContract,
} from '../src/path-config.mjs';
import contract from '../config/paths.v1.json' with { type: 'json' };

describe('typed portable ACC path configuration', () => {
  it('validates the versioned path-only contract and excludes repository-internal paths', () => {
    expect(validateAccPathContract(contract)).toEqual(contract);
    expect(contract.schemaVersion).toBe(ACC_PATH_SCHEMA_VERSION);
    expect(Object.keys(contract.paths).sort()).toEqual([
      'braveHermesEnvFile',
      'elevenLabsEnvFile',
      'hiveMindClient',
      'hiveMindTlsPinFile',
      'hiveMindTokenFile',
      'providerUsagePrivateCacheDir',
    ]);
    expect(JSON.stringify(contract)).not.toMatch(/(?:src|dist|standalone\/public|dashboard\/dist)/);
    expect(contract.paths.hiveMindClient.default).toBe('scripts/knowledge_search.py');
    expect(contract.paths.hiveMindTokenFile.default).toBe('.runtime/secrets/bridge-token');
    expect(contract.paths.providerUsagePrivateCacheDir.default).toBe('.runtime/provider-cache');
    expect(contract.paths.braveHermesEnvFile.default).toBe('.env');
    expect(contract.paths.elevenLabsEnvFile.default).toBe('.runtime/secrets/provider-usage.env');
  });

  it('resolves an absent optional TLS pin as null', () => {
    const resolved = resolveAccPathConfig({ contract, home: '/portable/home', env: {} });
    expect(resolved.hiveMindTlsPinFile).toBeNull();
  });

  it('applies explicit local config, CLI, environment, then portable default precedence', () => {
    const home = '/portable/home';
    const localConfig = {
      schemaVersion: ACC_PATH_SCHEMA_VERSION,
      paths: {
        hiveMindClient: 'local/client.py',
        hiveMindTokenFile: 'local/token',
      },
    };
    const resolved = resolveAccPathConfig({
      contract,
      localConfig,
      home,
      env: {
        HIVEMIND_CLIENT_PATH: '/env/client.py',
        HIVEMIND_TOKEN_FILE: '/env/token',
        ACC_PROVIDER_USAGE_PRIVATE_DIR: '/env/provider-cache',
      },
      overrides: { hiveMindClient: '/cli/client.py', hiveMindTlsPinFile: '/cli/tls-pin' },
    });
    expect(resolved.hiveMindClient).toBe('/portable/home/local/client.py');
    expect(resolved.hiveMindTokenFile).toBe('/portable/home/local/token');

    expect(resolved.hiveMindTlsPinFile).toBe('/cli/tls-pin');
    expect(resolved.providerUsagePrivateCacheDir).toBe('/env/provider-cache');
  });

  it('loads an explicit external config and rejects non-path or unknown values', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'acc-paths-'));
    const configPath = join(directory, 'paths.json');
    await writeFile(configPath, JSON.stringify({
      schemaVersion: ACC_PATH_SCHEMA_VERSION,
      paths: { providerUsagePrivateCacheDir: 'private/cache' },
    }));
    const resolved = await loadAccPathConfig({ contract, configPath, home: '/portable/home', env: {} });
    expect(resolved.providerUsagePrivateCacheDir).toBe('/portable/home/private/cache');
    expect(() => resolveAccPathConfig({ contract, home: '/portable/home', env: {}, localConfig: { schemaVersion: ACC_PATH_SCHEMA_VERSION, paths: { unknown: '/tmp/x' } } })).toThrow(/unknown path/i);
    expect(() => resolveAccPathConfig({ contract, home: '/portable/home', env: {}, localConfig: { schemaVersion: ACC_PATH_SCHEMA_VERSION, paths: { hiveMindClient: { secret: 'no' } } } })).toThrow(/path string/i);
    expect(() => resolveAccPathConfig({ contract, home: '/portable/home', env: {}, localConfig: { schemaVersion: ACC_PATH_SCHEMA_VERSION, paths: { hiveMindClient: '../escape.py' } } })).toThrow(/escape/i);
  });
});
