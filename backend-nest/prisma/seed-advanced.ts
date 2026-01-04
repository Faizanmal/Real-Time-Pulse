import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAdvancedFeatures() {
  console.log('Seeding advanced features...');

  // Seed Industry Templates
  const healthcareTemplate = await prisma.industryTemplate.upsert({
    where: { id: 'healthcare-template-1' },
    update: {},
    create: {
      id: 'healthcare-template-1',
      name: 'Healthcare HIPAA Dashboard',
      description: 'HIPAA-compliant dashboard for healthcare organizations',
      industry: 'HEALTHCARE',
      config: {
        widgets: [
          { type: 'METRIC', name: 'Patient Admissions', compliance: 'HIPAA' },
          { type: 'CHART', name: 'Treatment Outcomes', compliance: 'HIPAA' },
          {
            type: 'TABLE',
            name: 'Medical Records Access Log',
            compliance: 'HIPAA',
          },
        ],
        security: {
          encryption: true,
          auditLogging: true,
          accessControl: 'ROLE_BASED',
        },
      },
      thumbnail: 'https://example.com/healthcare-dashboard.png',
      rating: 4.8,
      usageCount: 42,
    },
  });

  const financeTemplate = await prisma.industryTemplate.upsert({
    where: { id: 'finance-template-1' },
    update: {},
    create: {
      id: 'finance-template-1',
      name: 'Financial Services Dashboard',
      description: 'PCI-DSS compliant dashboard for financial institutions',
      industry: 'FINANCE',
      config: {
        widgets: [
          { type: 'METRIC', name: 'Transaction Volume', compliance: 'PCI_DSS' },
          {
            type: 'CHART',
            name: 'Fraud Detection Rate',
            compliance: 'PCI_DSS',
          },
          { type: 'TABLE', name: 'Payment Processing', compliance: 'PCI_DSS' },
        ],
        security: {
          encryption: true,
          tokenization: true,
          mfa: true,
        },
      },
      thumbnail: 'https://example.com/finance-dashboard.png',
      rating: 4.9,
      usageCount: 67,
    },
  });

  // Seed AI Models
  const forecastingModel = await prisma.aIModel.upsert({
    where: { id: 'forecasting-model-1' },
    update: {},
    create: {
      id: 'forecasting-model-1',
      name: 'Time Series Forecaster',
      description: 'LSTM-based time series forecasting model',
      modelType: 'FORECASTING',
      provider: 'CUSTOM',
      modelId: 'lstm-v1',
      config: {
        epochs: 100,
        batchSize: 32,
        lookbackWindow: 30,
      },
      accuracy: 0.87,
      precision: 0.85,
      recall: 0.89,
      f1Score: 0.87,
      isPublic: true,
    },
  });

  const nlpModel = await prisma.aIModel.upsert({
    where: { id: 'nlp-model-1' },
    update: {},
    create: {
      id: 'nlp-model-1',
      name: 'Natural Language Query Engine',
      description: 'GPT-4 powered natural language to SQL converter',
      modelType: 'NLP',
      provider: 'OPENAI',
      modelId: 'gpt-4',
      config: {
        temperature: 0.2,
        maxTokens: 500,
      },
      isPublic: true,
    },
  });

  // Seed API Connectors
  const salesforceConnector = await prisma.aPIConnector.upsert({
    where: { id: 'salesforce-connector-1' },
    update: {},
    create: {
      id: 'salesforce-connector-1',
      name: 'Salesforce CRM',
      description:
        'Connect to Salesforce to track sales, leads, and opportunities',
      connectorType: 'REST',
      category: 'CRM',
      authType: 'OAUTH2',
      baseUrl: 'https://api.salesforce.com',
      apiVersion: 'v58.0',
      configSchema: {
        type: 'object',
        properties: {
          instanceUrl: { type: 'string' },
          apiVersion: { type: 'string', default: 'v58.0' },
        },
      },
      iconUrl: 'https://cdn.example.com/salesforce-icon.png',
      isPublic: true,
      isVerified: true,
      price: 0,
      rating: 4.7,
      downloads: 1523,
    },
  });

  const shopifyConnector = await prisma.aPIConnector.upsert({
    where: { id: 'shopify-connector-1' },
    update: {},
    create: {
      id: 'shopify-connector-1',
      name: 'Shopify E-commerce',
      description:
        'Connect to Shopify to track orders, products, and customers',
      connectorType: 'REST',
      category: 'E-commerce',
      authType: 'API_KEY',
      baseUrl: 'https://[store].myshopify.com/admin/api',
      apiVersion: '2024-01',
      configSchema: {
        type: 'object',
        properties: {
          storeName: { type: 'string' },
          apiKey: { type: 'string' },
        },
        required: ['storeName', 'apiKey'],
      },
      iconUrl: 'https://cdn.example.com/shopify-icon.png',
      isPublic: true,
      isVerified: true,
      price: 0,
      rating: 4.6,
      downloads: 892,
    },
  });

  // Seed Workflow Templates
  const alertWorkflow = await prisma.workflowTemplate.upsert({
    where: { id: 'alert-workflow-1' },
    update: {},
    create: {
      id: 'alert-workflow-1',
      name: 'Critical Alert Notification',
      description: 'Send notifications when critical metrics exceed thresholds',
      category: 'Alerts',
      template: {
        trigger: {
          type: 'METRIC_THRESHOLD',
          config: {
            metric: 'error_rate',
            operator: 'greater_than',
            value: 5,
          },
        },
        actions: [
          {
            type: 'send_email',
            config: {
              to: '{{admin_email}}',
              subject: 'Critical Alert: High Error Rate',
              template: 'alert-notification',
            },
          },
          {
            type: 'slack_message',
            config: {
              channel: '#alerts',
              message: '🚨 Critical: Error rate exceeded 5%',
            },
          },
        ],
        nodes: [],
        edges: [],
      },
      isPublic: true,
      rating: 4.5,
      usageCount: 234,
    },
  });

  const reportWorkflow = await prisma.workflowTemplate.upsert({
    where: { id: 'report-workflow-1' },
    update: {},
    create: {
      id: 'report-workflow-1',
      name: 'Weekly Report Generation',
      description: 'Automatically generate and email weekly reports',
      category: 'Reports',
      template: {
        trigger: {
          type: 'SCHEDULE',
          config: {
            cron: '0 9 * * 1', // Every Monday at 9 AM
          },
        },
        actions: [
          {
            type: 'generate_report',
            config: {
              format: 'PDF',
              portalIds: ['{{portal_ids}}'],
            },
          },
          {
            type: 'send_email',
            config: {
              to: '{{stakeholder_emails}}',
              subject: 'Weekly Report - {{week}}',
              attachReport: true,
            },
          },
        ],
        nodes: [],
        edges: [],
      },
      isPublic: true,
      rating: 4.7,
      usageCount: 156,
    },
  });

  // Seed Compliance Frameworks
  const hipaaFramework = await prisma.complianceFramework.upsert({
    where: { id: 'hipaa-framework' },
    update: {},
    create: {
      id: 'hipaa-framework',
      name: 'HIPAA',
      description:
        'Health Insurance Portability and Accountability Act compliance',
      requirements: [
        {
          id: 'HIPAA-1',
          name: 'Access Controls',
          description:
            'Implement technical policies and procedures for electronic information systems',
        },
        {
          id: 'HIPAA-2',
          name: 'Audit Controls',
          description:
            'Implement hardware, software, and/or procedural mechanisms',
        },
        {
          id: 'HIPAA-3',
          name: 'Integrity Controls',
          description:
            'Implement policies to ensure ePHI is not improperly altered',
        },
        {
          id: 'HIPAA-4',
          name: 'Transmission Security',
          description:
            'Implement technical security measures to guard against unauthorized access',
        },
      ],
      controls: [
        { id: 'C1', name: 'Encryption at rest', requirement: 'HIPAA-1' },
        { id: 'C2', name: 'Encryption in transit', requirement: 'HIPAA-4' },
        { id: 'C3', name: 'Audit logging', requirement: 'HIPAA-2' },
        { id: 'C4', name: 'Access logs', requirement: 'HIPAA-1' },
      ],
      auditSchedule: '0 0 1 */3 *', // Quarterly
    },
  });

  const pciDssFramework = await prisma.complianceFramework.upsert({
    where: { id: 'pci-dss-framework' },
    update: {},
    create: {
      id: 'pci-dss-framework',
      name: 'PCI-DSS',
      description: 'Payment Card Industry Data Security Standard compliance',
      requirements: [
        {
          id: 'PCI-1',
          name: 'Firewall Configuration',
          description: 'Install and maintain a firewall configuration',
        },
        {
          id: 'PCI-2',
          name: 'Password Security',
          description:
            'Do not use vendor-supplied defaults for system passwords',
        },
        {
          id: 'PCI-3',
          name: 'Protect Cardholder Data',
          description: 'Protect stored cardholder data',
        },
        {
          id: 'PCI-4',
          name: 'Encrypt Transmission',
          description: 'Encrypt transmission of cardholder data',
        },
      ],
      controls: [
        { id: 'C1', name: 'Network segmentation', requirement: 'PCI-1' },
        { id: 'C2', name: 'Strong passwords', requirement: 'PCI-2' },
        { id: 'C3', name: 'Data encryption', requirement: 'PCI-3' },
        { id: 'C4', name: 'TLS 1.2+', requirement: 'PCI-4' },
      ],
      auditSchedule: '0 0 1 */6 *', // Semi-annually
    },
  });

  const soc2Framework = await prisma.complianceFramework.upsert({
    where: { id: 'soc2-framework' },
    update: {},
    create: {
      id: 'soc2-framework',
      name: 'SOC 2',
      description: 'Service Organization Control 2 compliance',
      requirements: [
        {
          id: 'SOC2-1',
          name: 'Security',
          description: 'Protection against unauthorized access',
        },
        {
          id: 'SOC2-2',
          name: 'Availability',
          description: 'System is available for operation and use',
        },
        {
          id: 'SOC2-3',
          name: 'Confidentiality',
          description: 'Confidential information is protected',
        },
        {
          id: 'SOC2-4',
          name: 'Privacy',
          description:
            'Personal information is collected, used, retained, disclosed',
        },
      ],
      controls: [
        { id: 'C1', name: 'Access controls', requirement: 'SOC2-1' },
        { id: 'C2', name: 'Monitoring', requirement: 'SOC2-2' },
        { id: 'C3', name: 'Encryption', requirement: 'SOC2-3' },
        { id: 'C4', name: 'Privacy policy', requirement: 'SOC2-4' },
      ],
      auditSchedule: '0 0 1 */12 *', // Annually
    },
  });

  console.log('✓ Advanced features seeded successfully');
  console.log(`  - ${2} Industry Templates`);
  console.log(`  - ${2} AI Models`);
  console.log(`  - ${2} API Connectors`);
  console.log(`  - ${2} Workflow Templates`);
  console.log(`  - ${3} Compliance Frameworks`);
}

export { seedAdvancedFeatures };
