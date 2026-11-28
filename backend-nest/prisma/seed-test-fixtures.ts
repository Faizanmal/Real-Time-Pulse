import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, WorkspaceRole } from '@prisma/client';
import { Pool } from 'pg';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required; this fixture never uses DATABASE_URL.');
}

const parsedUrl = new URL(testDatabaseUrl);
if (
  !['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname) ||
  parsedUrl.pathname.replace(/^\//, '') !== 'pulse_test'
) {
  throw new Error('Refusing to seed fixtures: TEST_DATABASE_URL must target loopback database pulse_test.');
}

process.env.DATABASE_URL = testDatabaseUrl;
const pool = new Pool({ connectionString: testDatabaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const testPasswordHash = await bcrypt.hash('PulseDemo!2026', 12);
  const tenantA = await prisma.workspace.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Northstar Demo Studio',
      slug: 'northstar-demo-studio',
    },
  });
  const tenantB = await prisma.workspace.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Juniper Metrics Lab',
      slug: 'juniper-metrics-lab',
    },
  });

  const users = [
    {
      id: '00000000-0000-4000-8000-000000000011',
      email: 'owner@northstar.invalid',
      firstName: 'Northstar',
      lastName: 'Owner',
      name: 'Northstar Owner',
      workspaceId: tenantA.id,
      role: WorkspaceRole.OWNER,
    },
    {
      id: '00000000-0000-4000-8000-000000000012',
      email: 'client@northstar.invalid',
      firstName: 'Northstar',
      lastName: 'Client',
      name: 'Northstar Client Account',
      workspaceId: tenantA.id,
      role: WorkspaceRole.MEMBER,
    },
    {
      id: '00000000-0000-4000-8000-000000000021',
      email: 'owner@juniper.invalid',
      firstName: 'Juniper',
      lastName: 'Owner',
      name: 'Juniper Owner',
      workspaceId: tenantB.id,
      role: WorkspaceRole.OWNER,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        workspaceId: user.workspaceId,
        role: user.role,
        password: testPasswordHash,
      },
      create: { ...user, password: testPasswordHash, emailVerified: false },
    });
  }

  await prisma.portal.upsert({
    where: { id: '00000000-0000-4000-8000-000000000031' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000031',
      workspaceId: tenantB.id,
      createdById: '00000000-0000-4000-8000-000000000021',
      name: 'Juniper Private Test Portal',
      slug: 'juniper-private-test-portal',
      description: 'Private fictional portal used by local tenant-isolation tests.',
      isPublic: false,
      layout: [],
    },
  });

  const agencyPortal = await prisma.portal.upsert({
    where: { id: '00000000-0000-4000-8000-000000000032' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000032',
      workspaceId: tenantA.id,
      createdById: '00000000-0000-4000-8000-000000000011',
      name: 'Northstar Fictional KPI Portal',
      slug: 'northstar-fictional-kpi-portal',
      description: 'Fictional source records for local metric provenance smoke tests.',
      isPublic: true,
      layout: [],
    },
  });
  const secondClientPortal = await prisma.portal.upsert({
    where: { id: '00000000-0000-4000-8000-000000000033' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000033',
      workspaceId: tenantA.id,
      createdById: '00000000-0000-4000-8000-000000000011',
      name: 'Northstar Second Fictional Client Portal',
      slug: 'northstar-second-client-fixture',
      description: 'Second fictional client portal used to prove portal-scoped metric isolation.',
      isPublic: true,
      layout: [],
    },
  });

  const reportProject = await prisma.project.upsert({
    where: { id: '00000000-0000-4000-8000-000000000051' },
    update: {
      workspaceId: tenantA.id, name: 'Northstar Fictional Reporting Project', clientName: 'Northstar Fictional Client',
      budgetAmount: 5000, totalHours: 40, billableHours: 30, currency: 'USD',
    },
    create: {
      id: '00000000-0000-4000-8000-000000000051', workspaceId: tenantA.id,
      name: 'Northstar Fictional Reporting Project', clientName: 'Northstar Fictional Client',
      budgetAmount: 5000, totalHours: 40, billableHours: 30, currency: 'USD',
    },
  });
  await prisma.projectProfitability.upsert({
    where: { projectId: reportProject.id },
    update: { totalRevenue: 1200, billableRevenue: 1200, laborCosts: 400, expenseCosts: 200, totalCosts: 600, grossProfit: 600, profitMargin: 50, utilizationRate: 75, billableRatio: 75, profitabilityScore: 78, lastCalculatedAt: new Date() },
    create: { projectId: reportProject.id, totalRevenue: 1200, billableRevenue: 1200, laborCosts: 400, expenseCosts: 200, totalCosts: 600, grossProfit: 600, profitMargin: 50, utilizationRate: 75, billableRatio: 75, profitabilityScore: 78, lastCalculatedAt: new Date() },
  });

  await prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId: tenantB.id, provider: 'DEMO' } },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000042',
      workspaceId: tenantB.id,
      provider: 'DEMO',
      accessToken: 'DEMO_ONLY_NO_CREDENTIAL',
      accountName: 'Juniper fictional connector fixture',
      settings: { isDemo: true, datasetName: 'Juniper fictional fixture' },
      status: 'ACTIVE',
    },
  });

  const githubFixture = await prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId: tenantA.id, provider: 'GITHUB' } },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000043',
      workspaceId: tenantA.id,
      provider: 'GITHUB',
      accessToken: 'FIXTURE_ONLY_NOT_A_REAL_TOKEN',
      accountName: 'Northstar fictional GitHub fixture',
      settings: { isFixture: true, sync: { owner: 'fictional-northstar', repo: 'metric-fixture', perPage: 2 } },
      status: 'ACTIVE',
    },
  });

  const githubIssues = [
    { externalId: 'fixture-issue-101', payload: { state: 'open', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-11-20T12:00:00.000Z', closedAt: null, comments: 3, isPullRequest: false, labelNames: [] }, sourceUpdatedAt: new Date('2026-11-20T12:00:00.000Z') },
    { externalId: 'fixture-issue-102', payload: { state: 'closed', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-11-21T12:00:00.000Z', closedAt: '2026-11-21T12:00:00.000Z', comments: 5, isPullRequest: false, labelNames: [] }, sourceUpdatedAt: new Date('2026-11-21T12:00:00.000Z') },
    { externalId: 'fixture-issue-103', payload: { state: 'open', createdAt: '2026-01-03T00:00:00.000Z', updatedAt: '2026-11-22T12:00:00.000Z', closedAt: null, comments: null, isPullRequest: false, labelNames: [] }, sourceUpdatedAt: new Date('2026-11-22T12:00:00.000Z') },
  ];
  for (const issue of githubIssues) {
    await prisma.syncRecord.upsert({
      where: { integrationId_externalId: { integrationId: githubFixture.id, externalId: issue.externalId } },
      update: { payload: issue.payload, sourceUpdatedAt: issue.sourceUpdatedAt },
      create: { integrationId: githubFixture.id, ...issue },
    });
  }

  console.log(`Created fictional fixtures: 2 tenants, 2 owners, 1 client account, 3 portals, report project=${reportProject.id}, and 2 connectors; GitHub fixture portals=${agencyPortal.id},${secondClientPortal.id}, integration=${githubFixture.id}, issues=${githubIssues.length}.`);
  console.log('Local owner login: owner@northstar.invalid / PulseDemo!2026');
}

main()
  .catch((error: unknown) => {
    console.error('Test fixture seed failed:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
