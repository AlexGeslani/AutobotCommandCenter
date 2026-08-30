#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  MEDIA_EXTENSIONS,
  findSensitiveLabels,
  parsePrivateLiterals,
  representativeFrameTimes,
} from './media-safety-lib.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const scratch = await mkdtemp(resolve(tmpdir(), 'acc-media-safety-'));
const requireOcr = process.env.ACC_MEDIA_SAFETY_REQUIRE_OCR === '1';
const requireExiftool = process.env.ACC_MEDIA_SAFETY_REQUIRE_EXIFTOOL === '1';
const maxBuffer = 8 * 1024 * 1024;

async function run(command, args) {
  return execFileAsync(command, args, { cwd: root, encoding: 'utf8', maxBuffer });
}

async function commandAvailable(command, versionArgs) {
  try {
    await run(command, versionArgs);
    return true;
  } catch {
    return false;
  }
}

async function loadPrivateLiterals() {
  const literals = [];
  try {
    literals.push(...parsePrivateLiterals(
      await readFile(resolve(root, '.public-safety.private.json'), 'utf8'),
      '.public-safety.private.json',
    ));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (process.env.ACC_PUBLIC_SAFETY_PRIVATE_LITERALS_JSON) {
    literals.push(...parsePrivateLiterals(
      process.env.ACC_PUBLIC_SAFETY_PRIVATE_LITERALS_JSON,
      'ACC_PUBLIC_SAFETY_PRIVATE_LITERALS_JSON',
    ));
  }
  return [...new Set(literals)];
}

function metadataText(value, key = '') {
  const excludedKeys = new Set(['directory', 'filename', 'sourcefile']);
  if (excludedKeys.has(key.toLocaleLowerCase('en-US'))) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => metadataText(item)).join('\n');
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([childKey, childValue]) => metadataText(childValue, childKey)).join('\n');
  }
  return '';
}

function durationFromProbe(probe) {
  const candidates = [probe?.format?.duration, ...(probe?.streams ?? []).map((stream) => stream?.duration)];
  for (const candidate of candidates) {
    const duration = Number(candidate);
    if (Number.isFinite(duration) && duration > 0) return duration;
  }
  return null;
}

async function trackedMedia() {
  const { stdout } = await execFileAsync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'buffer', maxBuffer },
  );
  return stdout.toString('utf8').split('\0').filter(Boolean)
    .filter((name) => MEDIA_EXTENSIONS.has(extname(name).toLocaleLowerCase('en-US')))
    .sort();
}

async function compileVisionOcr() {
  if (process.platform !== 'darwin' || !await commandAvailable('swiftc', ['--version'])) return null;
  const output = resolve(scratch, 'media-ocr-vision');
  await run('swiftc', [resolve(root, 'scripts/media-ocr-vision.swift'), '-o', output]);
  return output;
}

async function extractFrame(source, timestamp, index) {
  const output = resolve(scratch, `frame-${index}.png`);
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-ss', String(timestamp), '-i', source, '-frames:v', '1', output,
  ]);
  return output;
}

const findings = [];
let decoded = 0;
let metadataInspected = 0;
let ocrSamples = 0;
let ocrBackend = 'none';
let metadataBackend = 'ffprobe';

try {
  for (const command of ['ffmpeg', 'ffprobe']) {
    if (!await commandAvailable(command, ['-version'])) {
      throw new Error(`${command} is required for committed-media safety validation`);
    }
  }

  const hasTesseract = await commandAvailable('tesseract', ['--version']);
  const visionOcr = hasTesseract ? null : await compileVisionOcr();
  if (hasTesseract) ocrBackend = 'tesseract';
  else if (visionOcr) ocrBackend = 'apple-vision';
  else if (requireOcr) throw new Error('OCR is required but neither Tesseract nor Apple Vision OCR is available');

  const hasExiftool = await commandAvailable('exiftool', ['-ver']);
  if (hasExiftool) metadataBackend = 'ffprobe+exiftool';
  else if (requireExiftool) throw new Error('ExifTool is required but unavailable');

  const privateLiterals = await loadPrivateLiterals();
  const media = await trackedMedia();
  let frameIndex = 0;

  for (const name of media) {
    const path = resolve(root, name);
    let probe;
    try {
      const { stdout } = await run('ffprobe', [
        '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path,
      ]);
      probe = JSON.parse(stdout);
      metadataInspected += 1;
      for (const label of findSensitiveLabels(metadataText(probe), privateLiterals)) {
        findings.push(`${name}: embedded metadata: ${label}`);
      }
    } catch {
      findings.push(`${name}: metadata inspection failed`);
      continue;
    }

    if (hasExiftool) {
      try {
        const { stdout } = await run('exiftool', ['-json', '-n', path]);
        for (const label of findSensitiveLabels(metadataText(JSON.parse(stdout)), privateLiterals)) {
          findings.push(`${name}: embedded metadata: ${label}`);
        }
      } catch {
        findings.push(`${name}: extended metadata inspection failed`);
      }
    }

    try {
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', path, '-f', 'null', '-']);
      decoded += 1;
    } catch {
      findings.push(`${name}: full decode failed`);
      continue;
    }

    if (ocrBackend === 'none') continue;
    const suffix = extname(name).toLocaleLowerCase('en-US');
    let inputs = [path];
    if (['.gif', '.mov', '.mp4', '.webm'].includes(suffix)) {
      const duration = durationFromProbe(probe);
      const timestamps = duration ? representativeFrameTimes(duration) : [0];
      inputs = [];
      for (const timestamp of timestamps) {
        try {
          inputs.push(await extractFrame(path, timestamp, frameIndex++));
        } catch {
          findings.push(`${name}: representative-frame extraction failed`);
        }
      }
    }

    for (const input of inputs) {
      try {
        const { stdout } = hasTesseract
          ? await run('tesseract', [input, 'stdout', '--psm', '11'])
          : await run(visionOcr, [input]);
        ocrSamples += 1;
        for (const label of findSensitiveLabels(stdout, privateLiterals)) {
          findings.push(`${name}: visible text: ${label}`);
        }
      } catch {
        findings.push(`${name}: OCR failed`);
      }
    }
  }

  if (findings.length) {
    console.error('Committed-media safety scan failed:');
    for (const finding of [...new Set(findings)].sort()) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log(`Committed-media safety scan passed: media=${media.length} decoded=${decoded} metadata=${metadataInspected} metadata_backend=${metadataBackend} ocr_samples=${ocrSamples} ocr_backend=${ocrBackend}.`);
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
