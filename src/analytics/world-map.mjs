import { WORLD_COUNTRIES } from './world-geometry-110m.mjs';

export { WORLD_COUNTRIES };

function levelFor(requests, maximum) {
  if (requests === 0 || maximum === 0) return 0;
  const normalized = Math.log1p(requests) / Math.log1p(maximum);
  return Math.max(1, Math.min(5, Math.ceil(normalized * 5)));
}

export function buildWorldTrafficModel(countries) {
  if (!Array.isArray(countries)) throw new TypeError('country aggregates must be an array');
  const rows = new Map(countries.map((row) => [row.code, row]));
  const geometryCodes = new Set(WORLD_COUNTRIES.map((feature) => feature.code).filter(Boolean));
  const maximum = Math.max(0, ...countries.map((row) => row.requests));
  const features = WORLD_COUNTRIES.map((feature) => {
    const row = feature.code ? rows.get(feature.code) : null;
    if (!row) return { ...feature, state: 'no_retained_value', requests: null, edgeResponseBytes: null, level: null };
    return {
      ...feature,
      state: row.requests === 0 ? 'observed_zero' : 'observed',
      requests: row.requests,
      edgeResponseBytes: row.edgeResponseBytes,
      level: levelFor(row.requests, maximum),
    };
  });
  const unmapped = countries.filter((row) => !geometryCodes.has(row.code)).map((row) => ({ ...row }));
  return { features, unmapped, maximum };
}
