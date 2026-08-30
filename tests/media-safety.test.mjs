import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  MEDIA_EXTENSIONS,
  findSensitiveLabels,
  representativeFrameTimes,
} from '../scripts/media-safety-lib.mjs';

describe('committed-media safety policy', () => {
  it('classifies high-confidence visible disclosures without echoing their values', () => {
    const privateIp = ['192', '168', '50', '10'].join('.');
    const privateHost = ['knowledge', 'lan'].join('.');
    const userPath = ['', 'Users', 'operator', 'private', 'notes.txt'].join('/');
    const email = ['operator', 'example.com'].join('@');
    const privateLiteral = 'synthetic-internal-label';
    const labels = findSensitiveLabels(
      `${privateIp} ${privateHost} ${userPath} ${email} ${privateLiteral}`,
      [privateLiteral],
    );

    expect(labels).toEqual([
      'email address',
      'macOS user path',
      'private infrastructure literal',
      'private IPv4 address',
      'private LAN hostname',
    ]);
    expect(labels.join(' ')).not.toContain(privateLiteral);
    expect(labels.join(' ')).not.toContain(privateIp);
  });

  it('selects representative video frames away from only the opening and closing frames', () => {
    expect(representativeFrameTimes(100)).toEqual([10, 30, 50, 70, 90]);
    expect(representativeFrameTimes(2)).toEqual([0.2, 0.6, 1, 1.4, 1.8]);
  });

  it('inventories only committed raster and moving-image formats', () => {
    expect([...MEDIA_EXTENSIONS].sort()).toEqual([
      '.gif', '.jpeg', '.jpg', '.mov', '.mp4', '.png', '.webm', '.webp',
    ]);
  });

  it('keeps the media gate in the project check and requires OCR plus extended metadata in CI', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

    expect(packageJson.scripts['security:media']).toBe('node scripts/check-media-safety.mjs');
    expect(packageJson.scripts.check).toContain('npm run security:media');
    expect(workflow).toContain('tesseract-ocr');
    expect(workflow).toContain('libimage-exiftool-perl');
    expect(workflow).toContain('ACC_MEDIA_SAFETY_REQUIRE_OCR=1');
    expect(workflow).toContain('ACC_MEDIA_SAFETY_REQUIRE_EXIFTOOL=1');
    expect(workflow).toContain('npm run security:media');
  });
});
