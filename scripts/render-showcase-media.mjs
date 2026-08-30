import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { FILM_DURATION_SECONDS, NARRATION_SEGMENTS } from './showcase-film-contract.mjs';

const root = resolve(import.meta.dirname, '..');
const silentVideo = process.env.ACC_SHOWCASE_SILENT_VIDEO;
const narrationDir = process.env.ACC_SHOWCASE_NARRATION_DIR;
const trimStart = Number(process.env.ACC_SHOWCASE_TRIM_START_SECONDS || 0);
const outputVideo = resolve(process.env.ACC_SHOWCASE_OUTPUT || resolve(root, 'docs/demo/autobot-command-center-demo.mp4'));
const outputGif = resolve(process.env.ACC_SHOWCASE_GIF_OUTPUT || resolve(root, 'docs/demo/autobot-command-center-demo-preview.gif'));

if (!silentVideo || !narrationDir) {
  throw new Error('ACC_SHOWCASE_SILENT_VIDEO and ACC_SHOWCASE_NARRATION_DIR are required');
}
if (!Number.isFinite(trimStart) || trimStart < 0) throw new Error('ACC_SHOWCASE_TRIM_START_SECONDS must be a non-negative number');

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

function probe(path) {
  return JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels', '-of', 'json', path]));
}

const manifest = JSON.parse(await readFile(resolve(narrationDir, 'manifest.json'), 'utf8'));
if (!Array.isArray(manifest.segments) || manifest.segments.length !== NARRATION_SEGMENTS.length) {
  throw new Error('Narration manifest does not match the film contract');
}

const inputs = ['-i', resolve(silentVideo)];
const filters = [];
const audioLabels = [];
for (let index = 0; index < NARRATION_SEGMENTS.length; index += 1) {
  const expected = NARRATION_SEGMENTS[index];
  const actual = manifest.segments[index];
  if (actual.id !== expected.id || actual.text !== expected.text) throw new Error(`Narration mismatch at ${expected.id}`);
  const path = resolve(actual.path);
  const duration = Number(probe(path).format.duration);
  const nextStart = NARRATION_SEGMENTS[index + 1]?.start ?? 62.6;
  const available = nextStart - expected.start - 0.12;
  const playbackRate = Math.max(1, duration / available);
  if (playbackRate > 1.25) throw new Error(`Narration segment ${expected.id} needs excessive speed-up (${playbackRate.toFixed(3)}x)`);
  const adjustedDuration = duration / playbackRate;
  const fadeOutStart = Math.max(0, adjustedDuration - 0.07);
  const label = `n${index}`;
  inputs.push('-i', path);
  filters.push(`[${index + 1}:a]aresample=48000,atempo=${playbackRate.toFixed(6)},afade=t=in:st=0:d=0.02,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=0.07,adelay=${Math.round(expected.start * 1000)}|${Math.round(expected.start * 1000)}[${label}]`);
  audioLabels.push(`[${label}]`);
}

const ambientIndex = NARRATION_SEGMENTS.length + 1;
const beepOneIndex = ambientIndex + 1;
const beepTwoIndex = ambientIndex + 2;
inputs.push('-f', 'lavfi', '-t', String(FILM_DURATION_SECONDS), '-i', 'sine=frequency=55:sample_rate=48000');
inputs.push('-f', 'lavfi', '-t', '0.12', '-i', 'sine=frequency=880:sample_rate=48000');
inputs.push('-f', 'lavfi', '-t', '0.12', '-i', 'sine=frequency=1320:sample_rate=48000');
filters.push(`[${ambientIndex}:a]volume=0.008[amb]`);
filters.push(`[${beepOneIndex}:a]volume=0.045,adelay=700|700[b1]`);
filters.push(`[${beepTwoIndex}:a]volume=0.035,adelay=1450|1450[b2]`);
filters.push(`${audioLabels.join('')}[amb][b1][b2]amix=inputs=${audioLabels.length + 3}:normalize=0,alimiter=limit=0.95[aout]`);
filters.push(`[0:v]trim=start=${trimStart}:duration=${FILM_DURATION_SECONDS},setpts=PTS-STARTPTS,fps=25,format=yuv420p[vout]`);

await mkdir(dirname(outputVideo), { recursive: true });
run('ffmpeg', [
  '-y', ...inputs,
  '-filter_complex', filters.join(';'),
  '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-level', '4.1',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '1',
  '-movflags', '+faststart',
  '-metadata', 'title=Autobot Command Center',
  '-metadata', 'comment=Actual-application public showcase; locally generated narration; sanitized dated projection.',
  '-t', String(FILM_DURATION_SECONDS), outputVideo,
]);

run('ffmpeg', ['-v', 'error', '-xerror', '-i', outputVideo, '-f', 'null', '-']);
run('ffmpeg', [
  '-y', '-ss', '2', '-t', '18', '-i', outputVideo,
  '-filter_complex', 'fps=8,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4',
  outputGif,
]);
run('ffmpeg', ['-v', 'error', '-xerror', '-i', outputGif, '-f', 'null', '-']);

const videoProbe = probe(outputVideo);
const gifProbe = probe(outputGif);
console.log(JSON.stringify({
  video: basename(outputVideo),
  durationSeconds: Number(videoProbe.format.duration),
  streams: videoProbe.streams,
  gif: basename(outputGif),
  gifDurationSeconds: Number(gifProbe.format.duration),
  narrationSegments: NARRATION_SEGMENTS.length,
}));
