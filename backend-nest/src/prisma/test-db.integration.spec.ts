import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL;
const parsedUrl = databaseUrl ? new URL(databaseUrl) : null;
const isApprovedTestDatabase = Boolean(
  parsedUrl &&
  ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname) &&
  parsedUrl.pathname.replace(/^\//, '') === 'pulse_test',
);

const suite = process.env.RUN_DB_INTEGRATION === 'true' && isApprovedTestDatabase ? describe : describe.skip;

suite('disposable database tenant fixtures', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it('separates fictional tenant accounts when scoped by workspace', async () => {
    const northstar = await prisma.workspace.findUniqueOrThrow({ where: { slug: 'northstar-demo-studio' } });
    const juniper = await prisma.workspace.findUniqueOrThrow({ where: { slug: 'juniper-metrics-lab' } });
    expect(northstar.id).not.toBe(juniper.id);

    const northstarUsers = await prisma.user.findMany({ where: { workspaceId: northstar.id } });
    const juniperUsers = await prisma.user.findMany({ where: { workspaceId: juniper.id } });
    expect(northstarUsers.map(({ email }) => email).sort()).toEqual([
      'client@northstar.invalid',
      'owner@northstar.invalid',
    ]);
    expect(juniperUsers.map(({ email }) => email)).toEqual(['owner@juniper.invalid']);
    expect(northstarUsers.every(({ password }) => typeof password === 'string' && password.length > 0)).toBe(true);
    const otherTenantPortal = await prisma.portal.findUniqueOrThrow({
      where: { id: '00000000-0000-4000-8000-000000000031' },
    });
    expect(otherTenantPortal.workspaceId).toBe(juniper.id);
    expect(otherTenantPortal.isPublic).toBe(false);
  });
});
