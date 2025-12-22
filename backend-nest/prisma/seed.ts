import { PrismaClient } from '@prisma/client';
import { seedAdvancedFeatures } from './seed-advanced';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with sample data...');

  // Create a sample workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
    },
  });

  console.log('✅ Created demo workspace:', workspace.name);

  // Create a sample user
  const user = await prisma.user.upsert({
    where: { email: 'demo@realtimepulse.com' },
    update: {},
    create: {
      email: 'demo@realtimepulse.com',
      name: 'Demo User',
      password: 'hashed_password_here', // In production, use proper bcrypt hash
      workspaceId: workspace.id,
    },
  });

  console.log('✅ Created demo user:', user.email);

  // Add user to workspace
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'ADMIN',
    },
  });

  // Seed Data Source Health Monitoring
  console.log('\n📊 Seeding Data Source Health...');

  // Create a sample integration first
  const integration = await prisma.integration.create({
    data: {
      workspaceId: workspace.id,
      provider: 'GOOGLE_ANALYTICS',
      accessToken: 'demo-token',
      accountId: '123456789',
      accountName: 'Demo GA Property',
      status: 'ACTIVE',
    },
  });

  const dataSources = await Promise.all([
    prisma.dataSourceHealth.create({
      data: {
        workspaceId: workspace.id,
        integrationId: integration.id,
        status: 'HEALTHY',
        lastCheckAt: new Date(),
      },
    }),
    prisma.dataSourceHealth.create({
      data: {
        workspaceId: workspace.id,
        integrationId: integration.id,
        status: 'HEALTHY',
        lastCheckAt: new Date(),
      },
    }),
    prisma.dataSourceHealth.create({
      data: {
        workspaceId: workspace.id,
        integrationId: integration.id,
        status: 'RATE_LIMITED',
        lastCheckAt: new Date(),
        lastError: 'Rate limit approaching',
      },
    }),
  ]);

  console.log(`✅ Created ${dataSources.length} data sources`);

  // Seed Data Validation Rules
  console.log('\n🔍 Seeding Validation Rules...');

  const validationRules = await Promise.all([
    prisma.dataValidationRule.create({
      data: {
        workspaceId: workspace.id,
        name: 'Revenue Must Be Positive',
        ruleType: 'NO_NEGATIVE_VALUES',
        fieldPath: 'revenue',
        severity: 'CRITICAL',
        enabled: true,
        config: {
          condition: '>= 0',
        },
      },
    }),
    prisma.dataValidationRule.create({
      data: {
        workspaceId: workspace.id,
        name: 'User Count Range Check',
        ruleType: 'RANGE_CHECK',
        fieldPath: 'userCount',
        severity: 'WARNING',
        enabled: true,
        config: {
          min: 0,
          max: 1000000,
        },
      },
    }),
    prisma.dataValidationRule.create({
      data: {
        workspaceId: workspace.id,
        name: 'Email Required Field',
        ruleType: 'REQUIRED_FIELD',
        fieldPath: 'email',
        severity: 'CRITICAL',
        enabled: true,
        config: {},
      },
    }),
  ]);

  console.log(`✅ Created ${validationRules.length} validation rules`);

  // Seed Profitability Data
  console.log('\n💰 Seeding Profitability Data...');

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Website Redesign',
        clientName: 'Acme Corporation',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        budgetAmount: 50000,
        hourlyRate: 150,
        status: 'ACTIVE',
      },
    }),
    prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Mobile App Development',
        clientName: 'TechStart Inc',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-06-30'),
        budgetAmount: 120000,
        hourlyRate: 175,
        status: 'ACTIVE',
      },
    }),
    prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Data Analytics Dashboard',
        clientName: 'FinServe Ltd',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2025-01-31'),
        budgetAmount: 35000,
        hourlyRate: 140,
        status: 'COMPLETED',
      },
    }),
  ]);

  console.log(`✅ Created ${projects.length} projects`);

  // Add time entries
  const timeEntries = await Promise.all([
    prisma.projectTimeEntry.create({
      data: {
        projectId: projects[0].id,
        userId: user.id,
        hours: 40,
        date: new Date('2025-01-15'),
        description: 'Initial design mockups',
        hourlyRate: 150,
      },
    }),
    prisma.projectTimeEntry.create({
      data: {
        projectId: projects[1].id,
        userId: user.id,
        hours: 60,
        date: new Date('2025-02-15'),
        description: 'Backend API development',
        hourlyRate: 175,
      },
    }),
  ]);

  console.log(`✅ Created ${timeEntries.length} time entries`);

  // Add expenses
  const expenses = await Promise.all([
    prisma.projectExpense.create({
      data: {
        projectId: projects[0].id,
        amount: 2500,
        category: 'Software Licenses',
        date: new Date('2025-01-10'),
        description: 'Design tools subscription',
      },
    }),
    prisma.projectExpense.create({
      data: {
        projectId: projects[1].id,
        amount: 5000,
        category: 'Infrastructure',
        date: new Date('2025-02-01'),
        description: 'AWS hosting setup',
      },
    }),
  ]);

  console.log(`✅ Created ${expenses.length} expenses`);

  // Seed Client Reports
  console.log('\n📄 Seeding Client Reports...');

  const clientReports = await Promise.all([
    prisma.clientReport.create({
      data: {
        workspaceId: workspace.id,
        title: 'January 2025 Progress Report',
        clientName: 'Acme Corporation',
        reportType: 'MONTHLY',
        executiveSummary: 'Excellent progress on website redesign',
        metrics: { hoursLogged: 160, budgetUsed: 24000 },
        status: 'SENT',
        sentAt: new Date(),
        recipientEmails: ['client@acme.com'],
      },
    }),
    prisma.clientReport.create({
      data: {
        workspaceId: workspace.id,
        title: 'Q1 2025 Quarterly Report',
        clientName: 'TechStart Inc',
        reportType: 'QUARTERLY',
        status: 'DRAFT',
        scheduledFor: new Date('2025-04-01'),
        recipientEmails: ['client@techstart.com'],
      },
    }),
  ]);

  console.log(`✅ Created ${clientReports.length} client reports`);

  // Seed GDPR Compliance Data
  console.log('\n🔒 Seeding GDPR Compliance...');

  const consents = await Promise.all([
    prisma.gDPRConsent.create({
      data: {
        workspaceId: workspace.id,
        subjectEmail: user.email,
        subjectName: user.name,
        consentType: 'DATA_PROCESSING',
        purpose: 'Data processing for analytics and reporting',
        consented: true,
        consentedAt: new Date(),
      },
    }),
    prisma.gDPRConsent.create({
      data: {
        workspaceId: workspace.id,
        subjectEmail: user.email,
        subjectName: user.name,
        consentType: 'MARKETING',
        purpose: 'Marketing communications and newsletters',
        consented: false,
      },
    }),
  ]);

  console.log(`✅ Created ${consents.length} GDPR consents`);

  const dataRequests = await Promise.all([
    prisma.gDPRDataRequest.create({
      data: {
        workspaceId: workspace.id,
        requesterEmail: user.email,
        requesterName: user.name,
        requestType: 'ACCESS',
        status: 'COMPLETED',
        submittedAt: new Date('2025-01-10'),
        processedAt: new Date('2025-01-12'),
      },
    }),
    prisma.gDPRDataRequest.create({
      data: {
        workspaceId: workspace.id,
        requesterEmail: user.email,
        requesterName: user.name,
        requestType: 'ERASURE',
        status: 'PENDING',
        submittedAt: new Date(),
      },
    }),
  ]);

  console.log(`✅ Created ${dataRequests.length} data requests`);

  // Seed advanced features
  await seedAdvancedFeatures();

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Summary:');
  console.log(`   - User: ${user.email}`);
  console.log(`   - Workspace: ${workspace.name} (${workspace.id})`);
  console.log(`   - Data Sources: ${dataSources.length}`);
  console.log(`   - Validation Rules: ${validationRules.length}`);
  console.log(`   - Projects: ${projects.length}`);
  console.log(`   - Time Entries: ${timeEntries.length}`);
  console.log(`   - Expenses: ${expenses.length}`);
  console.log(`   - Client Reports: ${clientReports.length}`);
  console.log(`   - GDPR Consents: ${consents.length}`);
  console.log(`   - Data Requests: ${dataRequests.length}`);
  console.log('\n💡 Use this workspace ID in frontend: ' + workspace.id);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
