#!/usr/bin/env node
// Restrict schema changes and fixture writes to the explicitly named loopback test DB.
try {
  require('dotenv').config();
} catch {
  // The required URL may also be supplied directly by the caller/CI environment.
}

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  console.error('TEST_DATABASE_URL is required. See backend-nest/.env.example.');
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(databaseUrl);
} catch {
  console.error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  process.exit(2);
}

if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname) || parsed.pathname.replace(/^\//, '') !== 'pulse_test') {
  console.error('Refusing database operation: TEST_DATABASE_URL must target loopback database pulse_test.');
  process.exit(2);
}

const action = process.argv[2];
const env = { ...process.env, DATABASE_URL: databaseUrl, RUN_DB_INTEGRATION: 'true' };
if (!['migrate', 'seed', 'integration'].includes(action)) {
  console.error('Usage: node scripts/test-db-runner.cjs <migrate|seed|integration>');
  process.exit(2);
}

function run(args) {
  const [tool, ...toolArgs] = args;
  const cliByTool = {
    prisma: path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js'),
    'ts-node': path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
    jest: path.join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js'),
  };
  const cli = cliByTool[tool];
  if (!cli || !fs.existsSync(cli)) {
    console.error(`${tool} is not installed. Restore the backend package lockfile and dependencies, then retry.`);
    return 1;
  }
  const result = spawnSync(process.execPath, [cli, ...toolArgs], { stdio: 'inherit', env, cwd: process.cwd() });
  if (result.error) {
    console.error(`Could not start ${args[0]}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

if (action === 'migrate') process.exit(run(['prisma', 'migrate', 'deploy', '--schema', './prisma/schema.prisma']));
if (action === 'seed') {
  const generateExitCode = run(['prisma', 'generate', '--schema', './prisma/schema.prisma']);
  if (generateExitCode !== 0) process.exit(generateExitCode);
  process.exit(run(['ts-node', '--transpile-only', 'prisma/seed-test-fixtures.ts']));
}

for (const args of [
  ['prisma', 'generate', '--schema', './prisma/schema.prisma'],
  ['prisma', 'migrate', 'deploy', '--schema', './prisma/schema.prisma'],
  ['ts-node', '--transpile-only', 'prisma/seed-test-fixtures.ts'],
  ['jest', '--runInBand', '--runTestsByPath', 'src/prisma/test-db.integration.spec.ts', 'src/analytics/metric-provenance.integration.spec.ts', 'src/analytics/value-ledger.integration.spec.ts', 'src/analytics/product-analytics.integration.spec.ts'],
]) {
  const exitCode = run(args);
  if (exitCode !== 0) process.exit(exitCode);
}
