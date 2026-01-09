#!/usr/bin/env node
// Simple runner: load .env then forward args to Prisma CLI via npx
try {
  require('dotenv').config();
} catch (e) {
  // ignore if dotenv not available
}

const { spawnSync } = require('child_process');
const args = process.argv.slice(2);

// If a datasource URL is available, and user did not pass --url explicitly, append it so Prisma CLI can run without relying on config parsing
const hasUrlFlag = args.some((a) => a === '--url' || a.startsWith('--url='));
if (!hasUrlFlag && process.env.DATABASE_URL) {
  args.push('--url', process.env.DATABASE_URL);
}

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const res = spawnSync(cmd, ['prisma', ...args], { stdio: 'inherit' });
process.exit(res.status);
