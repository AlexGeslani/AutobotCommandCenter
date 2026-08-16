#!/usr/bin/env node
import { writeAntigravityStatusLineCache } from '../adapters/antigravity-statusline.mjs';
import { captureAndPublishStatusLine } from '../lib/statusline-capture.mjs';
import { requestSnapshotPublication } from '../lib/request-snapshot-publication.mjs';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', async () => {
  // Raw Antigravity event data is deliberately never logged or persisted.
  const captured = await captureAndPublishStatusLine({ input, writeCache: writeAntigravityStatusLineCache, publish: requestSnapshotPublication });
  process.stdout.write(captured ? 'ACC Antigravity usage captured\n' : 'ACC Antigravity usage unavailable\n');
});
