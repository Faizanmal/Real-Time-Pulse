#!/usr/bin/env node
/*
 * Idempotent, optimistic-concurrency-safe token format transition.
 * Dry-run is the default. Never logs credential values.
 * Usage: node scripts/migrate-integration-tokens.cjs [--decrypt] [--apply]
 */
const { ConfigService } = require('@nestjs/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const apply = process.argv.includes('--apply');
const decrypt = process.argv.includes('--decrypt');
const targetVersion = decrypt ? 1 : 0;
const outputVersion = decrypt ? 0 : 1;
const batchSize = 100;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must contain at least 32 characters.');
  }

  const { EncryptionService } = require('../dist/common/services/encryption.service');
  const cipher = new EncryptionService(new ConfigService({ app: { encryptionKey: process.env.ENCRYPTION_KEY } }));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  let changed = 0;

  try {
    const total = await prisma.integration.count({ where: { tokenEncryptionVersion: targetVersion } });
    console.log(`${apply ? 'APPLY' : 'DRY-RUN'} ${decrypt ? 'decrypt' : 'encrypt'}: ${total} rows need conversion.`);
    if (!apply || total === 0) return;

    let unchangedPasses = 0;
    while (true) {
      const rows = await prisma.integration.findMany({
        where: { tokenEncryptionVersion: targetVersion },
        orderBy: { id: 'asc' },
        take: batchSize,
        select: {
          id: true,
          accessToken: true,
          refreshToken: true,
          tokenEncryptionVersion: true,
          updatedAt: true,
        },
      });
      if (rows.length === 0) break;

      let changedThisPass = 0;
      for (const row of rows) {
        const transform = decrypt ? cipher.decrypt.bind(cipher) : cipher.encrypt.bind(cipher);
        const result = await prisma.integration.updateMany({
          where: {
            id: row.id,
            tokenEncryptionVersion: targetVersion,
            updatedAt: row.updatedAt,
          },
          data: {
            accessToken: transform(row.accessToken),
            refreshToken: row.refreshToken === null ? null : transform(row.refreshToken),
            tokenEncryptionVersion: outputVersion,
          },
        });
        changedThisPass += result.count;
      }

      changed += changedThisPass;
      unchangedPasses = changedThisPass === 0 ? unchangedPasses + 1 : 0;
      if (unchangedPasses >= 3) {
        throw new Error('Rows kept changing during conversion. Pause credential writes and retry.');
      }
    }

    const remaining = await prisma.integration.count({ where: { tokenEncryptionVersion: targetVersion } });
    console.log(`Converted ${changed} rows; ${remaining} rows remain in version ${targetVersion}.`);
    if (remaining !== 0) throw new Error('Conversion incomplete; rerun after resolving concurrent writes.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Integration token conversion failed: ${error.message}`);
  process.exitCode = 1;
});
