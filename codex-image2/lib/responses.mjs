import { lookup } from 'node:dns/promises';
import { open } from 'node:fs/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import sharp from 'sharp';

export const DEFAULT_BRIDGE_MODEL = 'gpt-5.6-sol';
export const IMAGE_MODEL = 'gpt-image-2';
const MiB = 1024 * 1024;
const MAX_IMAGE_BYTES = 80 * MiB;
const MAX_IMAGE_PIXELS = 4096 * 4096;
const MAX_EVENT_BYTES = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64 * 1024;
const MAX_STREAM_BYTES = MAX_EVENT_BYTES * 4 + 256 * 1024;
const FORMATS = new Set(['png', 'jpeg', 'webp']);

export class ImagegenError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImagegenError';
    this.code = code;
  }
}
const invalid = (message) => new ImagegenError('INVALID_ARGUMENT', message);
const upstream = (message) => new ImagegenError('UPSTREAM_ERROR', message);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function baseEndpoint(value) {
  if (typeof value !== 'string' || !value.trim()) throw invalid('MODEL_BASE_URL is required.');
  let url;
  try { url = new URL(value); } catch { throw invalid('MODEL_BASE_URL must be an HTTP or HTTPS base URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.includes('?') || url.href.includes('#')) {
    throw invalid('MODEL_BASE_URL must not contain credentials, query parameters, or a fragment.');
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = `${pathname.endsWith('/v1') ? pathname : `${pathname}/v1`}/responses`;
  return url.href;
}

function validateOptions(options) {
  if (!object(options)) throw invalid('Generation options are required.');
  const {
    prompt, images = [], size = 'auto', quality = 'high', fit = 'strict', format = 'webp',
    baseUrl, apiKey, bridgeModel = DEFAULT_BRIDGE_MODEL, timeoutMs = 600_000, signal,
  } = options;
  if (typeof prompt !== 'string' || !prompt.trim()) throw invalid('A nonempty prompt is required.');
  if (!Array.isArray(images) || images.length > 16 || images.some((image) => typeof image !== 'string' || !image || image.includes('\0'))) {
    throw invalid('Provide at most 16 local image paths.');
  }
  let target = null;
  if (size !== 'auto') {
    if (typeof size !== 'string' || !/^\d{3,4}x\d{3,4}$/.test(size)) throw invalid('Size must be auto or WIDTHxHEIGHT.');
    const [width, height] = size.split('x').map(Number);
    if (width < 256 || height < 256 || width > 4096 || height > 4096) throw invalid('Image dimensions must be between 256 and 4096.');
    target = { width, height };
  }
  if (!['low', 'medium', 'high'].includes(quality)) throw invalid('Quality must be low, medium, or high.');
  if (!['strict', 'cover', 'raw'].includes(fit)) throw invalid('Fit must be strict, cover, or raw.');
  if (!FORMATS.has(format)) throw invalid('Format must be webp, png, or jpeg.');
  if (typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n\0]/.test(apiKey)) throw invalid('MODEL_API_KEY is required and must be a valid header value.');
  if (typeof bridgeModel !== 'string' || !bridgeModel.trim() || /[\r\n\0]/.test(bridgeModel)) throw invalid('Bridge model must be a nonempty model name.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) throw invalid('Timeout must be a positive number of milliseconds below 2147483648.');
  if (signal !== undefined && !(signal instanceof AbortSignal)) throw invalid('Signal must be an AbortSignal.');
  return { prompt, images, target, quality, fit, format, endpoint: baseEndpoint(baseUrl), apiKey, bridgeModel, timeoutMs, signal };
}

function closestUpstreamSize(target) {
  let { width, height } = target;
  if (width / height > 3) height = width / 3;
  else if (width / height < 1 / 3) width = height / 3;
  const scale = Math.min(Math.max(1, Math.sqrt(655_360 / (width * height))), 3840 / Math.max(width, height), Math.sqrt((3840 * 2160) / (width * height)));
  width = Math.round(width * scale / 16) * 16;
  height = Math.round(height * scale / 16) * 16;
  const roundedScale = Math.min(1, 3840 / Math.max(width, height), Math.sqrt((3840 * 2160) / (width * height)));
  if (roundedScale < 1) {
    width = Math.floor(width * roundedScale / 16) * 16;
    height = Math.floor(height * roundedScale / 16) * 16;
  }
  const minimumScale = Math.sqrt(655_360 / (width * height));
  if (minimumScale > 1) {
    width = Math.ceil(width * minimumScale / 16) * 16;
    height = Math.ceil(height * minimumScale / 16) * 16;
  }
  if (width > height * 3) height = Math.ceil(width / 3 / 16) * 16;
  else if (height > width * 3) width = Math.ceil(height / 3 / 16) * 16;
  return `${width}x${height}`;
}

async function referenceImage(path) {
  let handle;
  try {
    handle = await open(path, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > 10 * MiB) throw invalid('Each input image must be a nonempty regular file of at most 10 MiB.');
    // Read only the validated size plus one byte, even if the file grows concurrently.
    const bytes = Buffer.allocUnsafe(stat.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const { bytesRead } = await handle.read(bytes, count, bytes.length - count, null);
      if (!bytesRead) break;
      count += bytesRead;
    }
    if (count !== stat.size) throw invalid('An input image changed while it was being read.');
    const data = bytes.subarray(0, count);
    const image = sharp(data, { limitInputPixels: 64_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!FORMATS.has(metadata.format) || (metadata.pages ?? 1) !== 1) throw invalid('Input images must be single-frame JPEG, PNG, or WebP.');
    // Decode before making a paid request, so truncated/corrupt files fail locally.
    await image.stats();
    return { type: 'input_image', image_url: `data:image/${metadata.format};base64,${data.toString('base64')}` };
  } catch (error) {
    if (error instanceof ImagegenError) throw error;
    throw invalid('An input image could not be read or decoded within the 64-million-pixel limit.');
  } finally { await handle?.close(); }
}

function base64Reference(value) {
  const encoded = value.trim();
  if (!encoded.length || encoded.length % 4 || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) throw upstream('The returned Base64 image has an invalid size.');
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const end = encoded.length - padding;
  // A single linear scan avoids stack overflow from repeated regex capture groups.
  for (let i = 0; i < end; i++) {
    const c = encoded.charCodeAt(i);
    if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47)) {
      throw upstream('The returned image contains invalid Base64 data.');
    }
  }
  const length = encoded.length / 4 * 3 - padding;
  if (length < 1 || length > MAX_IMAGE_BYTES) throw upstream('The returned image exceeds the 80 MiB limit.');
  return { encoded };
}

function generatedUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw upstream('The returned image URL is invalid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw upstream('Returned image URLs must use HTTPS without credentials or fragments.');
  return url;
}

function imageReference(value) {
  if (typeof value !== 'string' || !value.length) throw upstream('The response contains an invalid image result.');
  if (value.startsWith('data:')) {
    const prefix = /^data:image\/(?:png|jpeg|webp);base64,/.exec(value);
    if (!prefix) throw upstream('The returned image data URL is invalid.');
    return base64Reference(value.slice(prefix[0].length));
  }
  if (/^https?:\/\//i.test(value)) return { url: generatedUrl(value) };
  return base64Reference(value);
}

function assertSuccess(payload, requireCompleted = false) {
  if (!object(payload)) throw upstream('The response contains an invalid result.');
  const type = typeof payload.type === 'string' ? payload.type : '';
  if ((payload.error !== undefined && payload.error !== null) || type === 'error' || type === 'response.incomplete' || type.endsWith('.failed') || payload.status === 'failed' || payload.status === 'incomplete' || payload.status === 'cancelled' || (requireCompleted && payload.status !== undefined && payload.status !== 'completed')) {
    throw upstream('Image generation did not complete successfully.');
  }
}

function outputReference(output) {
  if (!Array.isArray(output)) throw upstream('The response contains an invalid output list.');
  let result = null;
  for (const item of output) {
    if (!object(item) || item.type !== 'image_generation_call') continue;
    assertSuccess(item);
    if (Object.hasOwn(item, 'result')) {
      const reference = imageReference(item.result);
      result ??= reference;
    }
  }
  return result;
}

function parseJson(payload) {
  assertSuccess(payload, true);
  const reference = outputReference(payload.output);
  if (!reference) throw upstream('The response contained no generated image.');
  return { ...reference, source: 'json' };
}

async function cancelBody(response) {
  try { await response.body?.cancel(); } catch { /* The original failure is authoritative. */ }
}

async function declaredLimit(response, maximum) {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)) || Number(declared) > maximum)) {
    await cancelBody(response);
    throw upstream('The response has an invalid or oversized Content-Length.');
  }
  if (!response.body) throw upstream('The response contained no body.');
}

async function limitedBody(response, maximum, signal) {
  await declaredLimit(response, maximum);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) throw upstream('The response exceeded its byte limit.');
      chunks.push(value);
    }
    if (!total) throw upstream('The response body was empty.');
    return Buffer.concat(chunks, total);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

async function parseStream(response, signal) {
  await declaredLimit(response, MAX_STREAM_BYTES);
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let lineParts = [], lineLength = 0, eventName = '', dataLines = [], eventLength = 0;
  let total = 0, events = 0, partials = 0, ended = false;
  let candidate = null, priority = 0, partialIndex = -1;
  const retain = (reference, rank, source, index = -1) => {
    if (rank > priority || (rank === 1 && priority === 1 && index >= partialIndex)) {
      candidate = { ...reference, source };
      priority = rank;
      partialIndex = index;
    }
  };
  const flush = () => {
    const name = eventName.trim();
    const lines = dataLines;
    eventName = ''; dataLines = []; eventLength = 0;
    if (!lines.length) return;
    if (++events > 1024) throw upstream('The image stream contained more than 1024 events.');
    const data = lines.join('\n');
    if (data.trim() === '[DONE]') { ended = true; return; }
    let payload;
    try { payload = JSON.parse(data); } catch { throw upstream('The image stream contained invalid JSON.'); }
    assertSuccess(payload);
    const type = typeof payload.type === 'string' ? payload.type.trim() : '';
    if (name && type && name !== type) throw upstream('An image stream event name did not match its type.');
    const kind = type || name;
    if (kind === 'error' || kind === 'response.incomplete' || kind.endsWith('.failed')) throw upstream('The image generation stream failed.');
    if (kind === 'response.image_generation_call.partial_image') {
      if (++partials > 8) throw upstream('The image stream contained more than 8 partial images.');
      if (!Number.isSafeInteger(payload.partial_image_index) || payload.partial_image_index < 0 || typeof payload.partial_image_b64 !== 'string') throw upstream('The stream contained an invalid partial image.');
      retain(base64Reference(payload.partial_image_b64), 1, 'partial', payload.partial_image_index);
    } else if (kind === 'response.output_item.done') {
      if (!object(payload.item)) throw upstream('The image stream contained an invalid output item.');
      // Some gateways omit item.type; explicitly unrelated item types are never images.
      if (payload.item.type !== undefined && payload.item.type !== 'image_generation_call') return;
      assertSuccess(payload.item);
      if (Object.hasOwn(payload.item, 'result')) retain(imageReference(payload.item.result), 3, 'output_item');
    } else if (kind === 'image_generation.completed') {
      const reference = Object.hasOwn(payload, 'b64_json') ? imageReference(payload.b64_json) : imageReference(payload.url);
      retain(reference, 2, 'forwarded-completed');
    } else if (kind === 'response.completed') {
      assertSuccess(payload.response, true);
      const reference = outputReference(payload.response.output);
      if (reference) retain(reference, 4, 'completed');
      ended = true;
    }
  };
  const processLine = (raw) => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    eventLength += line.length;
    if (eventLength > MAX_EVENT_BYTES) throw upstream('The stream contained an oversized event.');
    if (!line) { flush(); return; }
    if (line.startsWith(':')) return;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
  };
  const feed = (text) => {
    let start = 0;
    for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', start)) {
      const part = text.slice(start, index);
      if (lineLength + part.length > MAX_EVENT_BYTES) throw upstream('The stream contained an oversized line.');
      if (lineParts.length) {
        lineParts.push(part);
        processLine(lineParts.join(''));
        lineParts = []; lineLength = 0;
      } else processLine(part);
      start = index + 1;
    }
    if (start < text.length) {
      const part = text.slice(start);
      lineLength += part.length;
      if (lineLength > MAX_EVENT_BYTES) throw upstream('The stream contained an oversized line.');
      lineParts.push(part);
    }
  };
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_STREAM_BYTES) throw upstream('The image stream exceeded its byte limit.');
      feed(decoder.decode(value, { stream: true }));
    }
    feed(decoder.decode());
    if (lineParts.length) processLine(lineParts.join(''));
    flush();
    if (!ended) throw upstream('The image stream ended before completion.');
    if (!candidate) throw upstream('The image stream contained no generated image.');
    return candidate;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

function publicIpv4(address) {
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

function publicAddress(address) {
  const version = isIP(address);
  if (version === 4) return publicIpv4(address);
  if (version !== 6 || address.includes('%')) return false;
  // Conservatively admit only ordinary IPv6 global unicast (2000::/3).
  // Excludes mapped/compatible IPv4, NAT64, local, multicast and scoped addresses.
  const host = new URL(`https://[${address}]/`).hostname.slice(1, -1);
  const [first, second = '0'] = host.split(':');
  const a = parseInt(first || '0', 16), b = parseInt(second || '0', 16);
  if (a < 0x2000 || a > 0x3fff) return false;
  if (a === 0x2001 && (b < 0x0200 || b === 0x0db8)) return false;
  if (a === 0x2002 || (a === 0x3fff && b <= 0x0fff)) return false;
  return true;
}

const defaultResolveHostname = async (hostname) => (await lookup(hostname, { all: true })).map(({ address }) => address);

async function publicAddresses(url, resolveHostname, signal) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  try {
    addresses = isIP(host) ? [host] : await abortable(resolveHostname(host), signal);
  } catch { throw upstream('The returned image hostname could not be resolved safely.'); }
  if (!Array.isArray(addresses) || !addresses.length || addresses.some((address) => typeof address !== 'string' || !publicAddress(address))) {
    throw upstream('Returned image URLs must resolve only to public network addresses.');
  }
  return addresses;
}

// Pin the already-validated DNS answer while retaining hostname/SNI and TLS verification.
// A preflight lookup followed by fetch(url) would permit DNS rebinding.
function pinnedDownload(url, addresses, signal) {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'GET', signal,
      headers: { accept: 'image/png, image/jpeg, image/webp', 'accept-encoding': 'identity' },
      lookup(_hostname, options, callback) {
        const entries = addresses.map((address) => ({ address, family: isIP(address) }));
        if (options.all) callback(null, entries);
        else callback(null, entries[0].address, entries[0].family);
      },
    }, (incoming) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      resolve({ body: Readable.toWeb(incoming), headers, status: incoming.statusCode,
        ok: incoming.statusCode >= 200 && incoming.statusCode < 300 });
    });
    req.on('error', reject);
    req.end();
  });
}

async function downloadImage(initial, dependencies, signal) {
  const downloadSignal = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
  const resolveHostname = dependencies.resolveHostname ?? defaultResolveHostname;
  let url = initial;
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      downloadSignal.throwIfAborted();
      const addresses = await publicAddresses(url, resolveHostname, downloadSignal);
      const response = dependencies.fetchImpl
        ? await abortable(dependencies.fetchImpl(url.href, { method: 'GET', redirect: 'manual', signal: downloadSignal, headers: { accept: 'image/png, image/jpeg, image/webp' } }), downloadSignal)
        : await pinnedDownload(url, addresses, downloadSignal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await cancelBody(response);
        const location = response.headers.get('location');
        if (!location || redirects === 3) throw upstream('The returned image exceeded the redirect limit or had an invalid redirect.');
        try { url = generatedUrl(new URL(location, url).href); }
        catch { throw upstream('The returned image redirect was unsafe.'); }
        continue;
      }
      if (!response.ok) { await cancelBody(response); throw upstream('The returned image could not be downloaded.'); }
      return await limitedBody(response, MAX_IMAGE_BYTES, downloadSignal);
    }
  } catch (error) {
    if (downloadSignal.aborted && !signal.aborted) throw new ImagegenError('TIMEOUT', 'The image download exceeded its 60-second timeout.');
    throw error;
  }
}

function abortable(promise, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function normalize(bytes, options, signal) {
  signal.throwIfAborted();
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw upstream('The generated image must be between 1 byte and 80 MiB.');
  let metadata;
  try { metadata = await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' }).metadata(); }
  catch { throw upstream('The generated image is invalid or exceeds the 4096²-pixel limit.'); }
  if (!FORMATS.has(metadata.format) || (metadata.pages ?? 1) !== 1) throw upstream('The generated image must be single-frame JPEG, PNG, or WebP.');
  const actual = metadata.autoOrient;
  if (!actual?.width || !actual?.height || actual.width * actual.height > MAX_IMAGE_PIXELS) throw upstream('The generated image dimensions are invalid.');
  let image = sharp(bytes, { autoOrient: true, limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' }).toColourspace('srgb');
  const target = options.target;
  if (target && options.fit !== 'raw') {
    if (options.fit === 'strict' && Math.round(actual.height * target.width / actual.width) !== target.height && Math.round(actual.width * target.height / actual.height) !== target.width) {
      throw new ImagegenError('ASPECT_MISMATCH', `Generated ${actual.width}x${actual.height} does not match requested ${target.width}x${target.height}. Use auto/raw to preserve geometry or cover to explicitly crop.`);
    }
    image = image.resize(target.width, target.height, options.fit === 'cover' ? { fit: 'cover', position: 'centre' } : { fit: 'fill' });
  }
  if (options.format === 'webp') image = image.webp({ quality: 90, effort: 6, alphaQuality: 90 });
  else if (options.format === 'jpeg') image = image.jpeg({ quality: 90 });
  else image = image.png();
  let result;
  try { result = await abortable(image.toBuffer({ resolveWithObject: true }), signal); }
  catch { throw upstream('The generated image could not be decoded or converted.'); }
  signal.throwIfAborted();
  if (!result.data.length || result.data.length > MAX_IMAGE_BYTES || result.info.width * result.info.height > MAX_IMAGE_PIXELS) throw upstream('The converted image exceeded output limits.');
  return { bytes: result.data, content_type: `image/${options.format}`, width: result.info.width, height: result.info.height };
}

export async function generateImage(options, dependencies = {}) {
  const config = validateOptions(options);
  const timeout = AbortSignal.timeout(config.timeoutMs);
  const signal = config.signal ? AbortSignal.any([timeout, config.signal]) : timeout;
  try {
    signal.throwIfAborted();
    const content = [{ type: 'input_text', text: config.target
      ? `${config.prompt}\n\nRequested image aspect ratio: ${config.target.width}:${config.target.height} (${config.target.width}x${config.target.height}). Compose the entire image for this ratio.`
      : config.prompt }];
    for (const path of config.images) {
      content.push(await abortable(referenceImage(path), signal));
      signal.throwIfAborted();
    }
    const payload = {
      model: config.bridgeModel, stream: true,
      input: [{ role: 'user', content }],
      tools: [{ type: 'image_generation', action: config.images.length ? 'edit' : 'generate', model: IMAGE_MODEL,
        quality: config.quality, output_format: 'png', size: config.target ? closestUpstreamSize(config.target) : 'auto', partial_images: 3 }],
      tool_choice: 'auto',
    };
    const response = await abortable((dependencies.fetchImpl ?? fetch)(config.endpoint, {
      method: 'POST', redirect: 'manual', signal,
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }), signal);
    if (!response.ok) {
      await cancelBody(response);
      if (response.status === 401 || response.status === 403) throw new ImagegenError('AUTH_FAILED', 'The configured image gateway rejected authentication.');
      throw upstream(`The Responses request failed with HTTP ${response.status}.`);
    }
    let selected;
    if ((response.headers.get('content-type') ?? '').toLowerCase().includes('text/event-stream')) {
      selected = await parseStream(response, signal);
    } else {
      const bytes = await limitedBody(response, MAX_EVENT_BYTES, signal);
      let payload;
      try { payload = JSON.parse(bytes.toString('utf8')); } catch { throw upstream('The Responses request returned invalid JSON.'); }
      selected = parseJson(payload);
    }
    const bytes = selected.encoded ? Buffer.from(selected.encoded, 'base64') : await downloadImage(selected.url, dependencies, signal);
    return { ...await normalize(bytes, config, signal), bridge_model: config.bridgeModel, image_model: IMAGE_MODEL, source: selected.source };
  } catch (error) {
    if (config.signal?.aborted) throw new ImagegenError('ABORTED', 'Image generation was cancelled.');
    if (timeout.aborted) throw new ImagegenError('TIMEOUT', 'Image generation exceeded the configured timeout.');
    if (error instanceof ImagegenError) throw error;
    throw upstream('Image generation failed while communicating with the configured gateway or processing its response.');
  }
}
