import { build } from 'esbuild';
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateShowcaseProjection } from '../src/showcase/projection.mjs';

const root = resolve(import.meta.dirname, '..');
const showcaseSnapshot = JSON.parse(await readFile(resolve(root, 'src/generated/showcase-projection.v1.json'), 'utf8'));
validateShowcaseProjection(showcaseSnapshot);
console.log(`Validated frozen showcase projection refreshed ${showcaseSnapshot.refreshedAt} (offline).`);
const dashboard = resolve(root, '.hermes/plugins/autobot-command-center/dashboard');
const out = resolve(dashboard, 'dist/index.js');
const analyticsShowcaseEnabled = process.env.ACC_ANALYTICS_SHOWCASE === '1';
const buildDefines = { 'globalThis.__ACC_ANALYTICS_SHOWCASE__': JSON.stringify(analyticsShowcaseEnabled) };
await mkdir(dirname(out), { recursive: true });
await build({
  entryPoints: [resolve(root, 'src/plugin.mjs')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  loader: { '.jpg': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl' },
  outfile: out,
  minify: false,
  legalComments: 'none',
  banner: { js: '/* Autobot Command Center prototype — Hermes dashboard plugin */' },
  define: buildDefines,
});
await copyFile(resolve(root, 'src/style.css'), resolve(dashboard, 'dist/style.css'));
const bundle = await readFile(out, 'utf8');
if (!bundle.includes("register(\"autobot-command-center\"")) {
  throw new Error('Bundle did not retain ACC plugin registration');
}
console.log(`Built ${out} (${Buffer.byteLength(bundle)} bytes)`);

const standalone = resolve(root, 'standalone/public');
const standaloneJs = resolve(standalone, 'app.js');
await mkdir(standalone, { recursive: true });
// Runtime snapshots are ignored; a fresh checkout must still build without one.
await mkdir(resolve(standalone, 'data'), { recursive: true });
await build({
  entryPoints: [resolve(root, 'src/standalone.mjs')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  loader: { '.jpg': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl' },
  outfile: standaloneJs,
  minify: true,
  legalComments: 'none',
  banner: { js: '/* ACC standalone human-gate build — same application source, no Hermes API */' },
  define: buildDefines,
});
const [appCss, standaloneCss] = await Promise.all([
  readFile(resolve(root, 'src/style.css'), 'utf8'),
  readFile(resolve(root, 'src/standalone.css'), 'utf8'),
]);
await writeFile(resolve(standalone, 'app.css'), `${standaloneCss}\n${appCss}`);
await copyFile(resolve(root, 'standalone/index.html'), resolve(standalone, 'index.html'));
await copyFile(resolve(root, 'standalone/autobot-mark.jpg'), resolve(standalone, 'autobot-mark.jpg'));
const showcaseDestination = resolve(standalone, 'data/analytics/showcase/kungfuclan-demo.v2.json');
if (analyticsShowcaseEnabled) {
  await mkdir(dirname(showcaseDestination), { recursive: true });
  await copyFile(resolve(root, 'tests/fixtures/analytics/kungfuclan-demo.v2.json'), showcaseDestination);
} else {
  await rm(showcaseDestination, { force: true });
}
await rm(resolve(dashboard, 'dist/data'), { recursive: true, force: true });
await cp(resolve(standalone, 'data'), resolve(dashboard, 'dist/data'), { recursive: true, force: true });
const standaloneBundle = await readFile(standaloneJs, 'utf8');
console.log(`Built ${standaloneJs} (${Buffer.byteLength(standaloneBundle)} bytes)`);
