import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { captureAndPublishStatusLine } from '../collector/lib/statusline-capture.mjs';

describe('status-line capture at the single-writer boundary', () => {
  it('caches a valid provider event without starting a parallel public-snapshot writer', async () => {
    const writeCache = vi.fn().mockResolvedValue(undefined);
    const captured = await captureAndPublishStatusLine({
      input: JSON.stringify({ quota: { example: true } }),
      writeCache,
    });
    expect(captured).toBe(true);
    expect(writeCache).toHaveBeenCalledWith({ quota: { example: true } });
  });

  it('does not cache malformed provider input', async () => {
    const writeCache = vi.fn();
    await expect(captureAndPublishStatusLine({ input: '{', writeCache })).resolves.toBe(false);
    expect(writeCache).not.toHaveBeenCalled();
  });

  it('keeps both status-line sinks cache-only so the scheduled collector remains the sole public writer', async () => {
    for (const file of ['claude-statusline-sink.mjs', 'antigravity-statusline-gate.mjs']) {
      const source = await readFile(new URL(`../collector/bin/${file}`, import.meta.url), 'utf8');
      expect(source).not.toContain('requestSnapshotPublication');
      expect(source).toContain('captureAndPublishStatusLine');
    }
  });
});
