import { describe, expect, it } from 'vitest';
import { buildWorldTrafficModel, WORLD_COUNTRIES } from '../src/analytics/world-map.mjs';

describe('dependency-free world traffic model', () => {
  it('maps observed country aggregates without inventing values for the rest of the geometry', () => {
    const model = buildWorldTrafficModel([
      { code: 'US', requests: 703, edgeResponseBytes: 23110872 },
      { code: 'CA', requests: 91, edgeResponseBytes: 6465233 },
    ]);
    expect(WORLD_COUNTRIES.length).toBeGreaterThan(150);
    expect(model.features.find((feature) => feature.code === 'US')).toMatchObject({ state: 'observed', requests: 703 });
    expect(model.features.find((feature) => feature.code === 'CA')).toMatchObject({ state: 'observed', requests: 91 });
    expect(model.features.find((feature) => feature.code === 'FR')).toMatchObject({ state: 'no_retained_value', requests: null });
    expect(model.unmapped).toEqual([]);
  });

  it('retains aggregate codes missing from the local geometry as explicit unmapped rows', () => {
    const model = buildWorldTrafficModel([{ code: 'ZZ', requests: 3, edgeResponseBytes: 9 }]);
    expect(model.unmapped).toEqual([{ code: 'ZZ', requests: 3, edgeResponseBytes: 9 }]);
  });
});