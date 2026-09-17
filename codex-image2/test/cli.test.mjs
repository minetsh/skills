import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(skillRoot, 'scripts', 'generate.mjs');
const testKey = 'cli-fixture-credential-not-a-real-key';

function runCli(args, cwd, baseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env: { ...process.env, MODEL_BASE_URL: baseUrl, MODEL_API_KEY: testKey, IMAGEGEN_BRIDGE_MODEL: 'gpt-5.6-sol' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('CLI did not finish')); }, 15000);
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', code => { clearTimeout(timeout); resolve({ code, stdout, stderr }); });
  });
}

async function startGateway(handler) {
  const requests = [];
  const server = createServer(async (request, response) => {
    try {
      let body = '';
      for await (const chunk of request) body += chunk;
      requests.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(body) });
      handler(request, response);
    } catch {
      response.writeHead(500).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, requests, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function closeGateway(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test('CLI generates from any working directory and refuses output/input clobbering before spending a request', { timeout: 30000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'image2 cli with spaces '));
  const generated = await sharp({ create: { width: 128, height: 128, channels: 3, background: '#dd9944' } }).png().toBuffer();
  const input = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#445577' } }).png().toBuffer();
  const gateway = await startGateway((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'completed', output: [{ type: 'image_generation_call', result: generated.toString('base64') }] }));
  });
  try {
    const first = await runCli(['--prompt', 'Make a square', '--size', '512x512', '--out', 'result image.webp'], directory, gateway.baseUrl);
    assert.equal(first.code, 0, first.stderr);
    const result = JSON.parse(first.stdout);
    assert.equal(result.success, true);
    assert.equal(await realpath(result.data.output_path), await realpath(join(directory, 'result image.webp')));
    assert.deepEqual(result.data.image_size, { width: 512, height: 512 });
    const metadata = await sharp(await readFile(result.data.output_path)).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
    assert.equal(first.stdout.includes(testKey) || first.stderr.includes(testKey), false);
    assert.equal(first.stdout.includes(generated.toString('base64')), false);
    assert.equal(gateway.requests[0].path, '/v1/responses');
    assert.equal(gateway.requests[0].authorization, `Bearer ${testKey}`);
    assert.equal(gateway.requests[0].body.tools[0].action, 'generate');
    assert.equal(gateway.requests[0].body.model, 'gpt-5.6-sol');

    const saved = await readFile(result.data.output_path);
    const collision = await runCli(['--prompt', 'Do not overwrite', '--out', 'result image.webp'], directory, gateway.baseUrl);
    assert.notEqual(collision.code, 0);
    assert.deepEqual(await readFile(result.data.output_path), saved);
    assert.equal(gateway.requests.length, 1);

    const inputPath = join(directory, 'input image.png');
    await writeFile(inputPath, input);
    const edit = await runCli(['--prompt', 'Edit this image', '--image', inputPath, '--out', 'edited.png'], directory, gateway.baseUrl);
    assert.equal(edit.code, 0, edit.stderr);
    assert.equal(gateway.requests[1].body.tools[0].action, 'edit');
    assert.equal(gateway.requests[1].body.input[0].content.filter(item => item.type === 'input_image').length, 1);
    assert.deepEqual(await readFile(inputPath), input);

    const overwriteInput = await runCli(['--prompt', 'Keep original safe', '--image', inputPath, '--out', inputPath, '--force'], directory, gateway.baseUrl);
    assert.notEqual(overwriteInput.code, 0);
    assert.deepEqual(await readFile(inputPath), input);
    assert.equal(gateway.requests.length, 2);

    await t.test('symlink aliases cannot bypass input protection', async (aliasTest) => {
      const alias = join(directory, 'input alias.png');
      try {
        await symlink(inputPath, alias);
      } catch (error) {
        if (error.code === 'EPERM' || error.code === 'ENOTSUP') {
          aliasTest.skip('This account cannot create symbolic links');
          return;
        }
        throw error;
      }
      const aliased = await runCli(['--prompt', 'Keep original safe', '--image', alias, '--out', inputPath, '--force'], directory, gateway.baseUrl);
      assert.notEqual(aliased.code, 0);
      assert.deepEqual(await readFile(inputPath), input);
      assert.equal(gateway.requests.length, 2);
    });
  } finally {
    await closeGateway(gateway.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI never writes a failed generation or exposes echoed credentials in errors', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'image2 failure '));
  const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#112233' } }).png().toBuffer();
  let mode = 'http';
  const gateway = await startGateway((_request, response) => {
    if (mode === 'http') {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: `Echo ${testKey}` } }));
    } else {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.end(`data: ${JSON.stringify({ type: 'response.image_generation_call.partial_image', partial_image_index: 0, partial_image_b64: image.toString('base64') })}\n\ndata: ${JSON.stringify({ type: 'error', error: { message: testKey } })}\n\ndata: [DONE]\n\n`);
    }
  });
  try {
    for (const failureMode of ['http', 'stream']) {
      mode = failureMode;
      const output = join(directory, `${mode}.webp`);
      const result = await runCli(['--prompt', 'Fixture generation', '--out', output], directory, gateway.baseUrl);
      assert.notEqual(result.code, 0);
      assert.equal(result.stdout.includes(testKey) || result.stderr.includes(testKey), false);
      assert.equal(result.stdout.includes(image.toString('base64')), false);
      assert.equal(JSON.parse(result.stderr).success, false);
      await assert.rejects(readFile(output), { code: 'ENOENT' });
    }
  } finally {
    await closeGateway(gateway.server);
    await rm(directory, { recursive: true, force: true });
  }
});
