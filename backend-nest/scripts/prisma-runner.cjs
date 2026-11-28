#!/usr/bin/env node
// Load .env and invoke the checked-in dependency installation without npx downloads.
try {
  require('dotenv').config();
} catch (e) {
  // ignore if dotenv not available
}

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);

const cli = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
if (!fs.existsSync(cli)) {
  console.error('Prisma CLI is not installed. Restore the backend package lockfile and dependencies, then retry.');
  process.exit(1);
}

const res = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', env: process.env });
if (res.error) {
  console.error(`Could not start Prisma CLI: ${res.error.message}`);
  process.exit(1);
}
process.exit(res.status ?? 1);
