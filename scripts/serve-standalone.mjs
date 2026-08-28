#!/usr/bin/env node
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'standalone', 'public');
const port = 9130;
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
]);

function regularFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const relative = normalize(pathname).replace(/^[/\\]+/, '');
  const candidate = resolve(root, relative || 'index.html');
  const safe = candidate === root || candidate.startsWith(`${root}/`);
  const selected = safe && regularFile(candidate) ? candidate : join(root, 'index.html');
  response.writeHead(200, {
    'Content-Type': types.get(extname(selected).toLowerCase()) || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(selected).pipe(response);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`ACC standalone SPA fixture listening on http://127.0.0.1:${port}\n`);
});
