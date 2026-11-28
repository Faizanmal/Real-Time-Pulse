import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { gzipSync } from 'node:zlib';
import { once } from 'node:events';
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const buildDir = resolve(process.env.NEXT_DIST_DIR || '.next');
const routes = [
  { label: 'mobile client portal', path: '/v/fictional-performance-share', budgetKiB: 300 },
  { label: 'agency dashboard', path: '/dashboard', budgetKiB: 500 },
];

function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not reserve a local benchmark port'));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function waitForServer(url, child, output) {
  const endAt = Date.now() + 30_000;
  while (Date.now() < endAt) {
    if (child.exitCode !== null) throw new Error(`Next server exited early: ${output()}`);
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Wait for the local server to finish binding.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`Timed out waiting for the local Next server: ${output()}`);
}

function scriptAssets(html, routePath) {
  const scripts = new Set();
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const assetUrl = new URL(match[1], `http://127.0.0.1${routePath}`);
    if (assetUrl.pathname.startsWith('/_next/static/') && assetUrl.pathname.endsWith('.js')) {
      scripts.add(decodeURIComponent(assetUrl.pathname.slice('/_next/'.length)));
    }
  }
  if (!scripts.size) throw new Error(`No initial JavaScript script tags found for ${routePath}`);
  return [...scripts];
}

async function main() {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const nextCli = resolve('node_modules/next/dist/bin/next');
  let serverOutput = '';
  const child = spawn(process.execPath, [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-4000); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);

  try {
    await waitForServer(origin, child, () => serverOutput);
    let failed = false;
    for (const route of routes) {
      const response = await fetch(new URL(route.path, origin));
      if (!response.ok) throw new Error(`${route.path} returned HTTP ${response.status}`);
      const html = await response.text();
      const scripts = scriptAssets(html, route.path);
      const assets = scripts.map((file) => {
        const absolute = resolve(buildDir, file);
        const assetRoot = resolve(buildDir, 'static') + sep;
        if (!absolute.startsWith(assetRoot)) throw new Error(`Unexpected script asset path: ${file}`);
        const payload = readFileSync(absolute);
        return { file, bytes: statSync(absolute).size, gzipBytes: gzipSync(payload, { level: 9 }).length };
      });
      const rawBytes = assets.reduce((total, asset) => total + asset.bytes, 0);
      const gzipBytes = assets.reduce((total, asset) => total + asset.gzipBytes, 0);
      const budgetBytes = route.budgetKiB * 1024;
      const pass = gzipBytes <= budgetBytes;
      failed ||= !pass;
      console.log(`${pass ? 'PASS' : 'FAIL'} ${route.label}: ${scripts.length} initial JS files, ${rawBytes} raw bytes, ${gzipBytes} gzip bytes (budget ${budgetBytes})`);
      console.log(`  inputs: ${assets.map(({ file, bytes }) => `${file} (${bytes} bytes)`).join(', ')}`);
    }
    process.exitCode = failed ? 1 : 0;
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolveWait) => setTimeout(resolveWait, 3000))]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
