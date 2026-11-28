import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalTeardownSmoke(): void {
  const backend = resolve(__dirname, '../backend-nest');
  const result = spawnSync('docker', ['compose', '-f', 'docker-compose.test.yml', 'down'], {
    cwd: backend,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`Disposable smoke Compose cleanup failed (exit ${result.status ?? 'unknown'}).`);
  }
}
