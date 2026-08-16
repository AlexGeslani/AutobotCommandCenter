import { spawn } from 'node:child_process';

const ALLOWED_METHODS = new Set(['initialize', 'initialized', 'account/rateLimits/read', 'account/usage/read']);

function isoFromUnixSeconds(value) {
  return Number.isInteger(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

function normalizeResetCredits(value) {
  if (!value || !Number.isInteger(value.availableCount) || value.availableCount < 0 || !Array.isArray(value.credits)) return null;
  const credits = value.credits.map((credit) => ({ expiresAt: isoFromUnixSeconds(credit?.expiresAt) }));
  if (credits.length !== value.availableCount || credits.some((credit) => !credit.expiresAt)) return null;
  return { availableCount: value.availableCount, credits };
}

export function normalizeCodexRateLimits(result, now = new Date().toISOString()) {
  const rateLimits = result?.rateLimits;
  if (!rateLimits || typeof rateLimits !== 'object') throw new TypeError('Codex response omitted rateLimits');
  const windows = [['primary', 'Primary window'], ['secondary', 'Secondary window']]
    .map(([key, label]) => ({ key, label, value: rateLimits[key] }))
    .filter(({ value }) => value && Number.isFinite(value.usedPercent) && isoFromUnixSeconds(value.resetsAt))
    .map(({ key, label, value }) => ({ id: key, label, usedPercent: value.usedPercent, resetsAt: isoFromUnixSeconds(value.resetsAt) }));
  const additional = result?.rateLimitsByLimitId?.codex_bengalfox?.primary;
  const resetCredits = normalizeResetCredits(result?.rateLimitResetCredits);
  const additionalReset = isoFromUnixSeconds(additional?.resetsAt);
  const isDuplicate = windows.some((window) => window.usedPercent === additional?.usedPercent && window.resetsAt === additionalReset);
  if (Number.isFinite(additional?.usedPercent) && additionalReset && !isDuplicate) {
    windows.push({ id: 'additional', label: 'GPT-5.3-Codex-Spark', usedPercent: additional.usedPercent, resetsAt: additionalReset });
  }
  return {
    provider: 'codex', product: 'Codex / ChatGPT', metricClass: 'subscription_quota',
    authority: 'installed Codex app-server account/rateLimits/read', collectionMode: 'local_app_server',
    adapterVersion: '1.0.0', sourceVersion: 'installed-app-server', observedAt: now,
    state: windows.length ? 'fresh' : 'unknown', windows,
    ...(resetCredits ? { resetCredits } : {}),
  };
}

function requestViaStdio({ command = 'codex', args = ['app-server', '--stdio'], timeoutMs = 15_000, now }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, CODEX_HOME: process.env.CODEX_HOME } });
    const pending = new Map(); let buffer = ''; let done = false;
    const finish = (error, value) => {
      if (done) return; done = true; clearTimeout(timer); child.kill('SIGTERM'); error ? reject(error) : resolve(value);
    };
    const send = (id, method, params) => {
      if (!ALLOWED_METHODS.has(method)) throw new TypeError(`disallowed Codex method: ${method}`);
      pending.set(id, { method }); child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    };
    const timer = setTimeout(() => finish(new Error('Codex app-server timed out')), timeoutMs);
    child.on('error', (error) => finish(error));
    child.stdout.on('data', (chunk) => {
      buffer += chunk; const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        let message; try { message = JSON.parse(line); } catch { continue; }
        if (!message?.id || !pending.has(message.id)) continue;
        const { method } = pending.get(message.id); pending.delete(message.id);
        if (message.error) return finish(new Error(`Codex ${method} failed`));
        if (method === 'initialize') { send(2, 'account/rateLimits/read', {}); continue; }
        if (method === 'account/rateLimits/read') return finish(null, normalizeCodexRateLimits(message.result, now));
      }
    });
    send(1, 'initialize', { clientInfo: { name: 'acc-provider-usage', version: '1.0.0' }, capabilities: { optOutNotificationMethods: ['thread/started', 'thread/completed'] } });
  });
}

export function createCodexAdapter(options = {}) {
  return { id: 'codex', collect: ({ now }) => requestViaStdio({ ...options, now }) };
}
