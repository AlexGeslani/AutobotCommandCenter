import { parseGitHubAnalyticsText } from './github-schema.mjs';

export function githubAnalyticsProjectionPath(subject) {
  if (!subject || subject.id !== 'github-portfolio' || typeof subject.projection !== 'string') throw new TypeError('GitHub analytics source is not connected');
  return subject.projection;
}

export async function loadGitHubAnalyticsProjection(basePath = '/', subject) {
  const base = new URL(basePath, window.location.origin);
  const url = new URL(githubAnalyticsProjectionPath(subject), `${base.href.replace(/\/?$/, '/')}`);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('GitHub analytics projection unavailable');
  return parseGitHubAnalyticsText(await response.text());
}
