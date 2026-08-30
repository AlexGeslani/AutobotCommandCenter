import { describe, expect, it } from 'vitest';
import {
  FILM_DURATION_SECONDS,
  NARRATION_SEGMENTS,
  SHOWCASE_SCENES,
} from '../scripts/showcase-film-contract.mjs';

describe('public showcase film contract', () => {
  it('stays within the portfolio-film duration and approved scene order', () => {
    expect(FILM_DURATION_SECONDS).toBeGreaterThanOrEqual(60);
    expect(FILM_DURATION_SECONDS).toBeLessThanOrEqual(75);
    expect(SHOWCASE_SCENES.map((scene) => scene.id)).toEqual([
      'boot', 'rapid-overview', 'portfolio', 'model-observatory', 'analytics', 'unified', 'payoff',
    ]);
    expect(SHOWCASE_SCENES.at(-1).end).toBe(FILM_DURATION_SECONDS);
  });

  it('uses the approved evidence-first narration with original voice framing', () => {
    const script = NARRATION_SEGMENTS.map((segment) => segment.text).join(' ');
    expect(script).toContain('Building AI systems is easy. Knowing what actually works is harder.');
    expect(script).toContain('No vibes. Exact model. Exact quant. Exact benchmark. Exact result.');
    expect(script).toContain('Missing data stays missing. Unknown never magically becomes zero.');
    expect(script).toContain('One evidence layer. Multiple interfaces. No second source of truth.');
    expect(script).toContain("This is how I'm building my own AI operating system.");
    expect(script).not.toContain(['Optimus', 'Prime'].join(' '));
    expect(script).not.toContain(['Peter', 'Cullen'].join(' '));
  });

  it('gives every narration segment a unique id and a bounded start time', () => {
    const ids = NARRATION_SEGMENTS.map((segment) => segment.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(NARRATION_SEGMENTS.every((segment) => segment.start >= 0 && segment.start < FILM_DURATION_SECONDS)).toBe(true);
  });
});
