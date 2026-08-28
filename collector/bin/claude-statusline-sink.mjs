#!/usr/bin/env node
import { writeClaudeStatusLineCache } from '../adapters/claude-statusline.mjs';
import { captureAndPublishStatusLine } from '../lib/statusline-capture.mjs';
import { requestSnapshotPublication } from '../lib/request-snapshot-publication.mjs';
import { loadAccPathConfig, pathInPrivateCache } from '../../src/path-config.mjs';

const paths = await loadAccPathConfig();
const cachePath = pathInPrivateCache('claude-statusline.json', paths);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', async () => {
  // Raw Claude payload is deliberately never logged or persisted.
  const captured = await captureAndPublishStatusLine({
    input,
    writeCache: (value) => writeClaudeStatusLineCache(value, { cachePath }),
    publish: requestSnapshotPublication,
  });
  process.stdout.write(captured ? 'ACC usage status captured\n' : 'ACC usage status unavailable\n');
});
