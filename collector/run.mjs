#!/usr/bin/env node
import { delimiter, resolve } from 'node:path';
import { collectProviderUsage } from './index.mjs';
import { createCodexAdapter } from './adapters/codex-app-server.mjs';
import { createClaudeAdapter } from './adapters/claude-statusline.mjs';
import { createAntigravityAdapter } from './adapters/antigravity-statusline.mjs';
import { createBraveSearchAdapter } from './adapters/brave-search.mjs';
import { writeAtomicJson } from './lib/atomic-json.mjs';

const defaultOutput = resolve(import.meta.dirname, '..', 'standalone', 'public', 'data', 'provider-usage.v1.json');
const configuredOutputs = process.env.ACC_PROVIDER_USAGE_SNAPSHOTS ?? process.env.ACC_PROVIDER_USAGE_SNAPSHOT ?? defaultOutput;
const outputs = [...new Set(configuredOutputs.split(delimiter).filter(Boolean))];
if (!outputs.length) throw new Error('no provider-usage snapshot output configured');

const snapshot = await collectProviderUsage({ adapters: [createCodexAdapter(), createClaudeAdapter(), createAntigravityAdapter(), createBraveSearchAdapter()] });
await Promise.all(outputs.map((output) => writeAtomicJson(output, snapshot)));
process.stdout.write(`published ${snapshot.providers.map((record) => `${record.provider}:${record.state}`).join(' ')} to ${outputs.length} target(s)\n`);
