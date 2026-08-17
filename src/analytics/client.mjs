import { parseWebAnalyticsText } from './schema.mjs';

const PROJECTION_PATHS = new Map([
  ['real:kungfuclan.com', 'data/analytics/web/kungfuclan.com.v2.json'],
  ['real:alexgeslani.com', 'data/analytics/web/alexgeslani.com.v2.json'],
  ['fixture:kungfuclan-demo', 'data/analytics/showcase/kungfuclan-demo.v2.json'],
]);

export function webAnalyticsProjectionPath({ subject, mode }) {
  const kind = mode === 'fixture' ? 'fixture' : 'real';
  const path = PROJECTION_PATHS.get(`${kind}:${subject}`);
  if (!path) throw new TypeError('analytics subject is not connected');
  return path;
}

export async function loadWebAnalyticsProjection(basePath = '/', { subject, mode } = {}) {
  const base = new URL(basePath, window.location.origin);
  const path = webAnalyticsProjectionPath({ subject, mode });
  const url = new URL(path, `${base.href.replace(/\/?$/, '/')}`);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Web analytics projection unavailable');
  return parseWebAnalyticsText(await response.text());
}
