import { describe, expect, it, vi } from 'vitest';
import { captureAndPublishStatusLine } from '../collector/lib/statusline-capture.mjs';

describe('status-line capture publication bridge', () => {
  it('publishes immediately after a valid provider event is cached', async () => {
    const writeCache = vi.fn().mockResolvedValue(undefined);
    const publish = vi.fn().mockResolvedValue(undefined);

    const captured = await captureAndPublishStatusLine({
      input: JSON.stringify({ quota: { example: true } }),
      writeCache,
      publish,
    });

    expect(captured).toBe(true);
    expect(writeCache).toHaveBeenCalledWith({ quota: { example: true } });
    expect(publish).toHaveBeenCalledOnce();
    expect(writeCache.mock.invocationCallOrder[0]).toBeLessThan(publish.mock.invocationCallOrder[0]);
  });

  it('does not publish malformed provider input', async () => {
    const writeCache = vi.fn();
    const publish = vi.fn();

    await expect(captureAndPublishStatusLine({ input: '{', writeCache, publish })).resolves.toBe(false);
    expect(writeCache).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
