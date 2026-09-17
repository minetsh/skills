import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { generateImage, ImagegenError } from '../lib/responses.mjs';

// All transport is injected: fixtures never contact a gateway or use real credentials.
const options = { prompt: 'Synthetic test image', baseUrl: 'https://gateway.invalid', apiKey: 'fixture-only', format: 'png' };
const cache = new Map();
function image(width = 16, height = 12, background = '#ff0000') {
  const key = `${width}:${height}:${background}`;
  if (!cache.has(key)) cache.set(key, sharp({ create: { width, height, channels: 3, background } }).png().toBuffer());
  return cache.get(key);
}
const output = (value) => ({ type: 'image_generation_call', result: value });
const jsonResponse = (value, extra = {}) => Response.json({ status: 'completed', output: [output(value)], ...extra });
const encode = (bytes) => bytes.toString('base64');
const completed = (value) => ({ type: 'response.completed', response: { status: 'completed', output: [output(value)] } });
const partial = (value, index) => ({ type: 'response.image_generation_call.partial_image', partial_image_index: index, partial_image_b64: value });
const itemDone = (value) => ({ type: 'response.output_item.done', item: output(value) });
const forwarded = (value) => ({ type: 'image_generation.completed', b64_json: value });
function sse(events, { fragment = 31, terminal = true } = {}) {
  const text = events.map((event) => `event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`).join('') + (terminal ? 'data: [DONE]\r\n\r\n' : '');
  const bytes = Buffer.from(text);
  let position = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (position === bytes.length) return controller.close();
      controller.enqueue(bytes.subarray(position, position + fragment));
      position = Math.min(bytes.length, position + fragment);
    },
  }), { headers: { 'content-type': 'text/event-stream' } });
}
const run = (response, overrides = {}, dependencies = {}) => generateImage({ ...options, ...overrides }, { fetchImpl: async () => response, ...dependencies });
const rejectsCode = (promise, code = 'UPSTREAM_ERROR') => assert.rejects(promise, (error) => error instanceof ImagegenError && error.code === code);
async function dimensions(result) {
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.width, result.width);
  assert.equal(metadata.height, result.height);
  return [metadata.width, metadata.height];
}

test('fragmented CRLF streams honor all candidate ranks and latest equal partial index', async () => {
  const a = encode(await image(16, 12));
  const b = encode(await image(18, 12));
  const c = encode(await image(20, 12));
  const d = encode(await image(22, 12));
  const partials = [partial(a, 2), partial(c, 1), partial(b, 2)];
  const cases = [
    { events: partials, source: 'partial', width: 18 },
    { events: [forwarded(c), ...partials], source: 'forwarded-completed', width: 20 },
    { events: [itemDone(d), forwarded(c), ...partials], source: 'output_item', width: 22 },
    { events: [completed(a), itemDone(d), forwarded(c), ...partials], source: 'completed', width: 16 },
  ];
  for (const { events, source, width } of cases) {
    const result = await run(sse(events, { fragment: 7 }));
    assert.equal(result.source, source);
    assert.deepEqual(await dimensions(result), [width, 12]);
  }
});

test('completed termination works without DONE and unrelated output items never become images', async () => {
  const good = encode(await image());
  const result = await run(sse([
    { type: 'response.output_item.done', item: { type: 'function_call', result: 'not an image' } },
    // Gateway compatibility: omitted item.type, but not an explicitly unrelated type.
    { type: 'response.output_item.done', item: { result: good } },
    { type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', result: null }] } },
  ], { terminal: false }));
  assert.equal(result.source, 'output_item');
  assert.deepEqual(await dimensions(result), [16, 12]);
  await rejectsCode(run(sse([partial(good, 0)], { terminal: false })));
});

test('terminal errors and malformed explicit results veto previously usable images', async () => {
  const good = encode(await image());
  const failures = [
    { type: 'error', error: { message: 'untrusted upstream detail' } },
    { type: 'response.incomplete' },
    { type: 'response.failed' },
    { type: 'response.completed', response: { status: 'failed', output: [output(good)] } },
    { type: 'response.completed', response: { status: 'completed', error: { message: 'hidden' }, output: [output(good)] } },
    { type: 'response.output_item.done', item: output(null) },
    { type: 'response.output_item.done', item: output('%%%invalid%%%') },
    { type: 'image_generation.completed', b64_json: 42, url: 'https://images.invalid/image.png' },
  ];
  for (const failure of failures) await rejectsCode(run(sse([completed(good), failure])));
  const mismatch = new Response(`event: response.completed\ndata: ${JSON.stringify(partial(good, 0))}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
  await rejectsCode(run(mismatch));
});

test('SSE event and partial bounds reject small-event floods', async () => {
  const good = encode(await image());
  await rejectsCode(run(sse(Array.from({ length: 9 }, (_, index) => partial(good, index)))));
  await rejectsCode(run(sse([...Array.from({ length: 1024 }, () => ({ type: 'response.created' })), completed(good)])));
  await rejectsCode(run(new Response('', { headers: { 'content-type': 'text/event-stream', 'content-length': '999999999999' } })));
});

test('JSON errors and malformed image results fail even if another image is usable', async () => {
  const good = encode(await image());
  for (const extra of [
    { status: 'incomplete' }, { status: 'failed' }, { error: { message: 'hidden' } }, { type: 'response.failed' },
    { output: [output(good), output(null)] }, { output: [output({ b64_json: good })] },
    { output: [output('AAAA=AAA')] },
  ]) await rejectsCode(run(jsonResponse(good, extra)));
  const result = await run(jsonResponse(good, { output: [{ type: 'message', result: null }, output(good)] }));
  assert.deepEqual(await dimensions(result), [16, 12]);
});

test('strict preserves aspect, cover explicitly crops, raw and auto retain actual geometry', async () => {
  const wide = encode(await image(320, 160));
  await rejectsCode(run(jsonResponse(wide), { size: '256x256' }), 'ASPECT_MISMATCH');
  const cover = await run(jsonResponse(wide), { size: '256x256', fit: 'cover' });
  assert.deepEqual(await dimensions(cover), [256, 256]);
  const raw = await run(jsonResponse(wide), { size: '256x256', fit: 'raw' });
  assert.deepEqual(await dimensions(raw), [320, 160]);
  const auto = await run(jsonResponse(wide));
  assert.deepEqual(await dimensions(auto), [320, 160]);
  const strict = await run(jsonResponse(wide), { size: '512x256' });
  assert.deepEqual(await dimensions(strict), [512, 256]);
});

test('orientation is physically applied and actual dimensions describe encoded bytes in every format', async () => {
  const oriented = await sharp(await image(30, 10)).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  for (const format of ['png', 'webp', 'jpeg']) {
    const result = await run(jsonResponse(encode(oriented)), { format });
    assert.deepEqual(await dimensions(result), [10, 30]);
    const metadata = await sharp(result.bytes).metadata();
    assert.equal(metadata.format, format);
    assert.equal(metadata.space, 'srgb');
    assert.equal(metadata.orientation, undefined);
  }
});

function oversizedPng(bytes, width, height) {
  const result = Buffer.from(bytes);
  result.writeUInt32BE(width, 16);
  result.writeUInt32BE(height, 20);
  let crc = 0xffffffff;
  for (const byte of result.subarray(12, 29)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 29);
  return result;
}

test('decoded output pixels and invalid image bytes are bounded independently of Base64 syntax', async () => {
  const small = await image();
  await rejectsCode(run(jsonResponse(encode(oversizedPng(small, 4097, 4096)))));
  await rejectsCode(run(jsonResponse(encode(Buffer.from('not an image')))));
  await rejectsCode(run(jsonResponse(encode(small.subarray(0, 45)))));
});

test('input byte, pixel, and decode failures happen before any network request', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-image2-input-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('network must not run'); };
  const bad = join(dir, 'bad.png');
  const pixels = join(dir, 'pixels.png');
  const big = join(dir, 'big.png');
  await writeFile(bad, 'not an image');
  await writeFile(pixels, oversizedPng(await image(), 8001, 8000));
  const file = await open(big, 'w');
  await file.truncate(10 * 1024 * 1024 + 1);
  await file.close();
  for (const path of [bad, pixels, big, dir]) await rejectsCode(generateImage({ ...options, images: [path] }, { fetchImpl }), 'INVALID_ARGUMENT');
  assert.equal(calls, 0);
});

test('reference edits use Responses only and generation redirects cannot forward credentials', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-image2-route-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'reference.png');
  const good = await image();
  await writeFile(path, good);
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(encode(good));
  };
  const result = await generateImage({ ...options, images: [path], baseUrl: 'https://gateway.invalid/prefix/v1/' }, { fetchImpl });
  assert.deepEqual(await dimensions(result), [16, 12]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://gateway.invalid/prefix/v1/responses');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.redirect, 'manual');
  let redirects = 0;
  await rejectsCode(generateImage(options, { fetchImpl: async (_url, init) => {
    redirects++;
    assert.equal(init.redirect, 'manual');
    return new Response(null, { status: 302, headers: { location: 'https://elsewhere.invalid' } });
  } }));
  assert.equal(redirects, 1);
});

test('credentialed or ambiguous base URLs and invalid options fail before transport', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('must not fetch'); };
  for (const baseUrl of ['https://user:pass@gateway.invalid', 'https://gateway.invalid?token=value', 'https://gateway.invalid#part', 'https://gateway.invalid?', 'https://gateway.invalid#']) {
    await rejectsCode(generateImage({ ...options, baseUrl }, { fetchImpl }), 'INVALID_ARGUMENT');
  }
  for (const override of [{ size: '255x256' }, { size: '4097x256' }, { quality: 'best' }, { fit: 'stretch' }, { images: Array(17).fill('x') }, { timeoutMs: 0 }]) {
    await rejectsCode(generateImage({ ...options, ...override }, { fetchImpl }), 'INVALID_ARGUMENT');
  }
  assert.equal(calls, 0);
});

test('returned URLs reject local/reserved IPv4, IPv6, mapped hexadecimal addresses and credentials', async () => {
  const urls = [
    'http://images.invalid/a.png', 'https://user:pass@images.invalid/a.png',
    'https://127.0.0.1/a.png', 'https://2130706433/a.png', 'https://0.0.0.0/a.png',
    'https://169.254.169.254/a.png', 'https://100.64.0.1/a.png', 'https://192.0.2.1/a.png',
    'https://198.51.100.1/a.png', 'https://203.0.113.1/a.png', 'https://224.0.0.1/a.png',
    'https://[::1]/a.png', 'https://[::ffff:127.0.0.1]/a.png', 'https://[::ffff:7f00:1]/a.png',
    'https://[fc00::1]/a.png', 'https://[2001::1]/a.png', 'https://[2001:db8::1]/a.png', 'https://[2002:7f00:1::]/a.png',
  ];
  for (const url of urls) {
    let requests = 0;
    await rejectsCode(generateImage(options, { fetchImpl: async () => {
      requests++;
      return jsonResponse(url);
    }, resolveHostname: async () => ['127.0.0.1'] }));
    assert.equal(requests, 1, 'unsafe destinations must never be fetched');
  }
  for (const addresses of [[], ['8.8.8.8', '10.0.0.1'], ['::ffff:a00:1']]) {
    let requests = 0;
    await rejectsCode(generateImage(options, { fetchImpl: async () => { requests++; return jsonResponse('https://images.invalid/a.png'); }, resolveHostname: async () => addresses }));
    assert.equal(requests, 1);
  }
});

test('safe downloads and redirects never receive API authorization, and every redirect is revalidated', async () => {
  const good = await image();
  const lookups = [];
  const requests = [];
  const result = await generateImage(options, {
    resolveHostname: async (host) => { lookups.push(host); return ['8.8.8.8']; },
    fetchImpl: async (url, init) => {
      requests.push(url);
      if (init.method === 'POST') return jsonResponse('https://first.invalid/image.png?signature=synthetic');
      assert.equal(new Headers(init.headers).has('authorization'), false);
      assert.equal(init.redirect, 'manual');
      if (url.includes('first.invalid')) return new Response(null, { status: 302, headers: { location: 'https://second.invalid/image.png' } });
      return new Response(good);
    },
  });
  assert.deepEqual(await dimensions(result), [16, 12]);
  assert.deepEqual(lookups, ['first.invalid', 'second.invalid']);
  assert.equal(requests.length, 3);
  let requestsToUnsafe = 0;
  await rejectsCode(generateImage(options, {
    resolveHostname: async () => ['8.8.8.8'],
    fetchImpl: async (_url, init) => {
      requestsToUnsafe++;
      return init.method === 'POST' ? jsonResponse('https://public.invalid/image.png') : new Response(null, { status: 302, headers: { location: 'https://[::ffff:7f00:1]/private' } });
    },
  }));
  assert.equal(requestsToUnsafe, 2);
});

test('download byte and redirect limits are enforced without trusting remote headers', async () => {
  const make = (get) => generateImage(options, {
    resolveHostname: async () => ['8.8.8.8'],
    fetchImpl: async (_url, init) => init.method === 'POST' ? jsonResponse('https://images.invalid/a.png') : get(),
  });
  await rejectsCode(make(() => new Response('x', { headers: { 'content-length': String(80 * 1024 * 1024 + 1) } })));
  await rejectsCode(make(() => new Response('x', { headers: { 'content-length': '-1' } })));
  let redirects = 0;
  await rejectsCode(make(() => { redirects++; return new Response(null, { status: 302, headers: { location: '/again' } }); }));
  assert.equal(redirects, 4);
  // A small reported length cannot bypass the independently counted streaming limit.
  const chunk = Buffer.alloc(1024 * 1024);
  let cancelled = false;
  await rejectsCode(make(() => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(chunk); },
    cancel() { cancelled = true; },
  }), { headers: { 'content-length': '1' } })));
  assert.equal(cancelled, true);
});

test('errors never reproduce raw upstream bodies, thrown messages, or cancellation reasons', async () => {
  const privateDetail = 'SYNTHETIC_PRIVATE_DETAIL';
  const errors = [
    run(new Response(privateDetail, { status: 500 })),
    generateImage(options, { fetchImpl: async () => { throw new Error(privateDetail); } }),
    run(jsonResponse(null, { error: { message: privateDetail } })),
  ];
  for (const promise of errors) await assert.rejects(promise, (error) => error instanceof ImagegenError && !error.message.includes(privateDetail));
  const controller = new AbortController();
  controller.abort(new Error(privateDetail));
  await rejectsCode(generateImage({ ...options, signal: controller.signal }), 'ABORTED');
});
