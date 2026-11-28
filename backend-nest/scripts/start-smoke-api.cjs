const { spawn, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const backendDir = path.resolve(__dirname, '..', '..', 'backend-nest');
const tsNodeRegister = path.join(backendDir, 'node_modules', 'ts-node', 'register');
const tsConfigPathsRegister = path.join(backendDir, 'node_modules', 'tsconfig-paths', 'register');
if (!existsSync(path.join(tsNodeRegister, 'index.js')) || !existsSync(tsConfigPathsRegister + '.js')) {
  console.error('Cannot start smoke API: backend dependencies are missing. Run npm ci in backend-nest first.');
  process.exit(1);
}
const databaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://pulse_test:pulse_test_only_password@127.0.0.1:55432/pulse_test?schema=public';
if (!/^postgres(?:ql)?:\/\/[^@]+@(?:127\.0\.0\.1|localhost):\d+\/pulse_test(?:\?|$)/i.test(databaseUrl)) {
  console.error('Refusing smoke API startup: TEST_DATABASE_URL must point to loopback database pulse_test.');
  process.exit(1);
}
const testEnv = {
  ...process.env,
  NODE_ENV: 'test',
  EMAIL_TEST_TRANSPORT: 'true',
  CLIENT_BRIEFINGS_ENABLED: 'true',
  PORT: '3000',
  FRONTEND_URL: 'http://127.0.0.1:3001',
  TEST_DATABASE_URL: databaseUrl,
  DATABASE_URL: databaseUrl,
  TEST_POSTGRES_PORT: new URL(databaseUrl).port || '5432',
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: process.env.TEST_REDIS_PORT || '57379',
  TEST_REDIS_HOST: '127.0.0.1',
  TEST_REDIS_PORT: process.env.TEST_REDIS_PORT || '57379',
  JWT_SECRET: process.env.JWT_SECRET || 'local-smoke-only-jwt-secret-32-chars',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'local-smoke-only-encryption-key-32',
  ONBOARDING_FUNNEL_HMAC_KEY: process.env.ONBOARDING_FUNNEL_HMAC_KEY || 'local-smoke-only-funnel-hmac-key-32-bytes',
};

function runDocker(args) {
  const result = spawnSync('docker', ['compose', '-f', 'docker-compose.test.yml', ...args], {
    cwd: backendDir,
    encoding: 'utf8',
    env: testEnv,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

function waitForRedis(host, port) {
  const deadline = Date.now() + 30_000;
  return new Promise((resolveReady, rejectReady) => {
    const attempt = () => {
      if (Date.now() >= deadline) {
        rejectReady(new Error(`Disposable Redis did not answer PING at ${host}:${port}.`));
        return;
      }
      const socket = net.createConnection({ host, port });
      const timeout = setTimeout(() => {
        socket.destroy();
        retry();
      }, 1_000);
      const retry = () => {
        clearTimeout(timeout);
        socket.destroy();
        setTimeout(attempt, 250);
      };
      socket.once('connect', () => socket.write('*1\r\n$4\r\nPING\r\n'));
      socket.once('data', (data) => {
        clearTimeout(timeout);
        socket.end();
        if (data.toString().includes('PONG')) resolveReady();
        else retry();
      });
      socket.once('error', retry);
    };
    attempt();
  });
}

let cleanupStarted = false;
function stopDisposableServices() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  runDocker(['down']);
}

async function start() {
  const composeStatus = runDocker(['up', '-d', '--wait', '--force-recreate']);
  if (composeStatus !== 0) throw new Error(`Disposable test Compose exited ${composeStatus}.`);

  const database = spawnSync(process.execPath, ['scripts/test-db-runner.cjs', 'integration'], {
    cwd: backendDir,
    encoding: 'utf8',
    env: testEnv,
  });
  if (database.stdout) process.stdout.write(database.stdout);
  if (database.stderr) process.stderr.write(database.stderr);
  if (database.status !== 0) throw new Error(`Disposable database preparation exited ${database.status ?? 1}.`);

  await waitForRedis('127.0.0.1', Number(testEnv.TEST_REDIS_PORT));
  const child = spawn(process.execPath, ['-r', tsNodeRegister, '-r', tsConfigPathsRegister, 'src/main.ts'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...testEnv, TS_NODE_TRANSPILE_ONLY: 'true', TS_NODE_PREFER_TS_EXTS: 'true' },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('exit', (code) => {
    stopDisposableServices();
    process.exit(code ?? 1);
  });
}

start().catch((error) => {
  console.error(error.message);
  stopDisposableServices();
  process.exit(1);
});
