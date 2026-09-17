#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);
const fail = (message) => {
  process.stderr.write(`${JSON.stringify({ success: false, error: { code: 'SETUP_FAILED', message } })}\n`);
  process.exitCode = 1;
};

if (major < 20 || (major === 20 && minor < 19)) {
  fail('Install Node.js 20.19 or newer, then run this setup script again.');
} else if (process.argv.length > 2) {
  fail('Setup accepts no arguments. Run node <SKILL_ROOT>/scripts/setup.mjs.');
} else {
  // Windows npm is a .cmd launcher. Only this fixed command is passed to cmd;
  // the skill path is supplied separately as cwd, never interpolated into a shell.
  const args = ['ci', '--ignore-scripts', '--no-audit', '--no-fund'];
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm ci --ignore-scripts --no-audit --no-fund'], { cwd: skillRoot, stdio: 'ignore', windowsHide: true })
    : spawnSync('npm', args, { cwd: skillRoot, stdio: 'ignore' });
  if (result.error || result.status !== 0) {
    fail('Dependency installation failed. Ensure npm is on PATH, package-lock.json is present, the skill directory is writable, and the npm registry is reachable. Then rerun setup.');
  } else {
    process.stdout.write(`${JSON.stringify({ success: true, data: { dependencies: 'installed', next: 'Run scripts/generate.mjs --check; configure your own MODEL_BASE_URL and MODEL_API_KEY privately if missing.' } })}\n`);
  }
}
