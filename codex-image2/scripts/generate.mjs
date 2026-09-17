#!/usr/bin/env node
import { parseArgs, parseEnv } from 'node:util';
import { readFile, realpath, stat, lstat, open, link, rename, unlink } from 'node:fs/promises';
import { dirname, basename, extname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_BRIDGE_MODEL = 'gpt-5.6-sol';
let EngineError;

class CliError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const help = `codex-image2 — Responses-only image generation

Usage (input/output paths are relative to your current working directory):
  node <SKILL_ROOT>/scripts/generate.mjs --prompt TEXT --out PATH.webp
  node <SKILL_ROOT>/scripts/generate.mjs --prompt-file PATH --image PATH --out PATH.png
  node <SKILL_ROOT>/scripts/generate.mjs --check

Options:
  --prompt TEXT           Text prompt; exactly one prompt source is required
  --prompt-file PATH      UTF-8 prompt file, mutually exclusive with --prompt
  --image PATH            Local JPEG/PNG/WebP reference; repeat up to 16 times
  --size auto|WxH         Default auto; explicit width/height each 256–4096
  --quality LEVEL         low | medium | high (default high)
  --fit MODE              strict | cover | raw (default strict)
                         strict rejects aspect mismatch; cover center-crops;
                         raw preserves returned geometry; auto never resizes
  --out PATH              .webp | .png | .jpg | .jpeg; parent must exist
  --force                 Replace a regular output, never an input or symlink
  --timeout SECONDS       Total generation timeout (default 600)
  --bridge-model NAME     Override IMAGEGEN_BRIDGE_MODEL (default gpt-5.6-sol)
  --check                 Check runtime, local dependencies and config; no network
  --help                  Show help without needing dependencies or credentials

Configuration: MODEL_BASE_URL and MODEL_API_KEY are required. Only skill-local
.env then .env.local are loaded; existing process environment wins, even if empty.
Never pass keys as arguments. No Codex/omp login or host-project config is read.
Setup once: node <SKILL_ROOT>/scripts/setup.mjs
`;

function parseOptions() {
  let parsed;
  try {
    parsed = parseArgs({
      strict: true,
      allowPositionals: false,
      tokens: true,
      options: {
        prompt: { type: 'string' },
        'prompt-file': { type: 'string' },
        image: { type: 'string', multiple: true },
        size: { type: 'string' },
        quality: { type: 'string' },
        fit: { type: 'string' },
        out: { type: 'string' },
        force: { type: 'boolean' },
        timeout: { type: 'string' },
        'bridge-model': { type: 'string' },
        check: { type: 'boolean' },
        help: { type: 'boolean' },
      },
    });
  } catch {
    throw new CliError('INVALID_ARGUMENT', 'Unknown option, positional argument, or missing option value. Run --help for supported arguments.');
  }
  const seen = new Set();
  for (const token of parsed.tokens) {
    if (token.kind !== 'option') continue;
    if (token.name !== 'image' && seen.has(token.name)) {
      throw new CliError('INVALID_ARGUMENT', 'Only --image may be repeated.');
    }
    seen.add(token.name);
  }
  const options = parsed.values;
  if ((options.help || options.check) && seen.size !== 1) {
    throw new CliError('INVALID_ARGUMENT', 'Use --help or --check alone, without generation options.');
  }
  return options;
}

async function loadConfig() {
  const local = Object.create(null);
  for (const name of ['.env', '.env.local']) {
    try {
      Object.assign(local, parseEnv(await readFile(join(skillRoot, name), 'utf8')));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw new CliError('CONFIG_ERROR', 'Cannot read skill-local .env or .env.local. Check file permissions and dotenv syntax privately.');
    }
  }
  const value = (name) => Object.hasOwn(process.env, name) ? process.env[name] : local[name];
  return {
    baseUrl: value('MODEL_BASE_URL')?.trim() ?? '',
    apiKey: value('MODEL_API_KEY')?.trim() ?? '',
    bridgeModel: value('IMAGEGEN_BRIDGE_MODEL')?.trim() ?? DEFAULT_BRIDGE_MODEL,
  };
}

function configProblems(config) {
  const problems = [];
  if (!config.baseUrl) {
    problems.push('Configure MODEL_BASE_URL privately in the process environment or skill-local .env/.env.local.');
  } else {
    try {
      const url = new URL(config.baseUrl);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.includes('?') || url.href.includes('#')) throw new Error();
    } catch {
      problems.push('MODEL_BASE_URL must be an HTTP(S) URL without embedded credentials, query, or fragment.');
    }
  }
  if (!config.apiKey) problems.push('Configure your own MODEL_API_KEY privately; Codex/omp authentication is not inherited.');
  else if (/[\r\n\0]/u.test(config.apiKey)) problems.push('MODEL_API_KEY must not contain line breaks or null characters.');
  if (!config.bridgeModel || /[\r\n\0]/u.test(config.bridgeModel)) problems.push('IMAGEGEN_BRIDGE_MODEL must be a nonempty single-line model name without null characters.');
  return problems;
}

async function loadEngine() {
  try {
    const engine = await import('../lib/responses.mjs');
    EngineError = engine.ImagegenError;
    return engine;
  } catch {
    throw new CliError('DEPENDENCIES_UNAVAILABLE', 'Image engine or sharp is unavailable. Run node <SKILL_ROOT>/scripts/setup.mjs with Node.js 20.19+ and npm; keep lib/responses.mjs and package-lock.json with this skill.');
  }
}

function generationOptions(options, config) {
  if (Object.hasOwn(options, 'prompt') === Object.hasOwn(options, 'prompt-file')) {
    throw new CliError('INVALID_ARGUMENT', 'Specify exactly one of --prompt or --prompt-file.');
  }
  if (!options.out?.trim()) throw new CliError('INVALID_ARGUMENT', '--out is required.');
  const format = { '.webp': 'webp', '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg' }[extname(options.out).toLowerCase()];
  if (!format) throw new CliError('INVALID_ARGUMENT', '--out must end in .webp, .png, .jpg, or .jpeg.');
  const size = options.size ?? 'auto';
  if (size !== 'auto') {
    const match = /^(\d{3,4})x(\d{3,4})$/u.exec(size);
    if (!match || match.slice(1).some((part) => Number(part) < 256 || Number(part) > 4096)) {
      throw new CliError('INVALID_ARGUMENT', '--size must be auto or WxH with integer dimensions from 256 to 4096.');
    }
  }
  const quality = options.quality ?? 'high';
  const fit = options.fit ?? 'strict';
  if (!['low', 'medium', 'high'].includes(quality)) throw new CliError('INVALID_ARGUMENT', '--quality must be low, medium, or high.');
  if (!['strict', 'cover', 'raw'].includes(fit)) throw new CliError('INVALID_ARGUMENT', '--fit must be strict, cover, or raw.');
  const seconds = options.timeout === undefined ? 600 : Number(options.timeout);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 2147483.647) {
    throw new CliError('INVALID_ARGUMENT', '--timeout must be a positive number of seconds no greater than 2147483.647.');
  }
  const images = options.image ?? [];
  if (images.length > 16 || images.some((image) => !image.trim())) throw new CliError('INVALID_ARGUMENT', 'Supply at most 16 nonempty --image paths.');
  if (options['prompt-file'] !== undefined && !options['prompt-file'].trim()) throw new CliError('INVALID_ARGUMENT', '--prompt-file must be a nonempty path.');
  const bridgeModel = options['bridge-model']?.trim() ?? config.bridgeModel;
  if (!bridgeModel || /[\r\n\0]/u.test(bridgeModel)) throw new CliError('INVALID_ARGUMENT', 'The bridge model must be a nonempty single-line name without null characters.');
  return { ...config, size, quality, fit, format, timeoutMs: Math.max(1, Math.round(seconds * 1000)), bridgeModel, images };
}

async function inspectInput(path) {
  try {
    const canonical = await realpath(resolve(path));
    const info = await stat(canonical);
    if (!info.isFile()) throw new Error();
    return { path: canonical, dev: info.dev, ino: info.ino };
  } catch {
    throw new CliError('INPUT_ERROR', 'A reference image or prompt file is missing, unreadable, or not a regular file. Check your input paths relative to the current directory.');
  }
}

async function inspectDestination(path, inputs, force) {
  if (inputs.some((input) => input.path === path)) throw new CliError('INPUT_OVERWRITE', 'Output must not overwrite any reference image or prompt file, even with --force.');
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (info.isSymbolicLink()) throw new CliError('OUTPUT_SYMLINK', 'Output must not be a symbolic link, even with --force. Choose a new output path.');
  if (!info.isFile()) throw new CliError('OUTPUT_ERROR', 'Output must be a regular file path.');
  // Reject aliases by inode as well as canonical path, including hard links.
  if (inputs.some((input) => input.dev === info.dev && input.ino === info.ino)) {
    throw new CliError('INPUT_OVERWRITE', 'Output aliases an input file; choose a different path. --force cannot replace an input.');
  }
  if (!force) throw new CliError('OUTPUT_EXISTS', 'Output already exists. Choose a new path or use --force to replace a non-input regular file.');
}

async function saveOutput(path, bytes, inputs, force) {
  const temporary = join(dirname(path), `.codex-image2-${randomUUID()}.tmp`);
  let handle;
  let created = false;
  try {
    handle = await open(temporary, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await inspectDestination(path, inputs, force);
    if (force) await rename(temporary, path);
    else await link(temporary, path); // Atomic no-clobber publication, including races.
  } catch (error) {
    if (error.code === 'EEXIST') throw new CliError('OUTPUT_EXISTS', 'Output was created by another process. No file was overwritten; choose a new path.');
    throw error;
  } finally {
    if (handle) await handle.close().catch(() => {});
    if (created) await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw new CliError('OUTPUT_CLEANUP_FAILED', 'Cannot remove a temporary output file. Check output-directory permissions and remove .codex-image2-*.tmp privately.');
    });
  }
}

async function main() {
  const options = parseOptions();
  if (options.help) {
    process.stdout.write(help);
    return;
  }
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 20 || (major === 20 && minor < 19)) throw new CliError('RUNTIME_UNSUPPORTED', 'Node.js 20.19 or newer is required.');
  const config = await loadConfig();
  if (options['bridge-model'] !== undefined) config.bridgeModel = options['bridge-model'].trim();
  const problems = configProblems(config);
  if (options.check) {
    try { await loadEngine(); } catch (error) { problems.push(error.message); }
    if (problems.length) throw new CliError('NOT_READY', problems.join(' '));
    process.stdout.write(`${JSON.stringify({ success: true, data: { ready: true, configuration: 'present', dependencies: 'available', network_checked: false } })}\n`);
    return;
  }
  const request = generationOptions(options, config);
  if (problems.length) throw new CliError('CONFIG_ERROR', problems.join(' '));
  const inputs = await Promise.all(request.images.map(inspectInput));
  request.images = inputs.map((input) => input.path);
  if (options['prompt-file'] !== undefined) {
    const input = await inspectInput(options['prompt-file']);
    inputs.push(input);
    request.prompt = await readFile(input.path, 'utf8');
  } else {
    request.prompt = options.prompt;
  }
  if (!request.prompt.trim()) throw new CliError('INVALID_ARGUMENT', 'The prompt must not be empty.');
  const requestedOutput = resolve(options.out);
  let output;
  try {
    output = join(await realpath(dirname(requestedOutput)), basename(requestedOutput));
  } catch {
    throw new CliError('OUTPUT_ERROR', 'The output parent directory must exist and be accessible. Create it before generation.');
  }
  await inspectDestination(output, inputs, options.force);
  const { generateImage } = await loadEngine();
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const result = await generateImage({ ...request, signal: controller.signal });
    if (controller.signal.aborted) throw new CliError('INTERRUPTED', 'Generation was interrupted; no output was saved.');
    await saveOutput(output, result.bytes, inputs, options.force);
    process.stdout.write(`${JSON.stringify({ success: true, data: {
      output_path: output,
      content_type: result.content_type,
      image_size: { width: result.width, height: result.height },
      bridge_model: result.bridge_model,
      image_model: result.image_model,
      source: result.source,
    } })}\n`);
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

try {
  await main();
} catch (error) {
  const safe = error instanceof CliError || (EngineError && error instanceof EngineError);
  const code = safe ? error.code : 'IO_ERROR';
  const message = safe ? error.message : 'Operation failed. Check input/output permissions, available disk space, and local configuration. No raw error details are logged.';
  process.stderr.write(`${JSON.stringify({ success: false, error: { code, message } })}\n`);
  process.exitCode = 1;
}
