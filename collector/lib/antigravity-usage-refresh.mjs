import { buildProviderUsageSnapshot } from '../../src/provider-usage/schema.mjs';

function inactiveAntigravityRecord(prior, now) {
  let lastGood = null;
  try {
    const candidate = buildProviderUsageSnapshot({ generatedAt: now, providers: [prior] }, now).providers[0];
    if (candidate.provider === 'antigravity') lastGood = candidate;
  } catch {
    // Private cache bytes must satisfy the public allowlist before retention.
  }
  const fallback = {
    provider: 'antigravity',
    product: 'Antigravity CLI',
    metricClass: 'subscription_quota',
    authority: 'documented Antigravity CLI status-line quota event',
    collectionMode: 'status_line_cache',
    adapterVersion: '1.0.0',
    sourceVersion: 'not_configured',
    observedAt: now,
    windows: [],
  };
  const record = { ...(lastGood || fallback), state: 'inactive' };
  return buildProviderUsageSnapshot({ generatedAt: now, providers: [record] }, now).providers[0];
}

export async function reconcileAntigravityActivity({
  hasActiveTrustedSession,
  probeTrustedSession = async () => false,
  readRecord,
  writeRecord,
  now = new Date().toISOString(),
}) {
  if (await hasActiveTrustedSession()) return { outcome: 'active_session' };
  if (await probeTrustedSession()) return { outcome: 'refreshed' };
  let prior = null;
  try {
    prior = await readRecord();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const record = inactiveAntigravityRecord(prior, now);
  await writeRecord(record);
  return { outcome: 'inactive', record };
}
