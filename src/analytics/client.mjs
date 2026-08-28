import { parseWebAnalyticsText } from './schema.mjs';

export function webAnalyticsProjectionPath({ subject, subjects = [] }) {
  const selected = subjects.find((item) => item.id === subject);
  if (!selected) throw new TypeError('analytics subject is not connected');
  return selected.projection;
}

export async function loadWebAnalyticsProjection(basePath = '/', { subject, subjects = [] } = {}) {
  const base = new URL(basePath, window.location.origin);
  const path = webAnalyticsProjectionPath({ subject, subjects });
  const url = new URL(path, `${base.href.replace(/\/?$/, '/')}`);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Web analytics projection unavailable');
  return parseWebAnalyticsText(await response.text());
}
