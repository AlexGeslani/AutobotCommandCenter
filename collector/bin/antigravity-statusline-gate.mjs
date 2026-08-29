#!/usr/bin/env node
import { writeAntigravityStatusLineCache } from '../adapters/antigravity-statusline.mjs';
import { captureAndPublishStatusLine } from '../lib/statusline-capture.mjs';
import { loadAccPathConfig, pathInPrivateCache } from '../../src/path-config.mjs';

const paths = await loadAccPathConfig();
const cachePath = pathInPrivateCache('antigravity-statusline.json', paths);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', async () => {
  // Raw Antigravity event data is deliberately never logged or persisted.
  const captured = await captureAndPublishStatusLine({
    input,
    writeCache: (value) => writeAntigravityStatusLineCache(value, { cachePath }),
  });
  process.stdout.write(captured ? 'ACC Antigravity usage captured\n' : 'ACC Antigravity usage unavailable\n');
});
