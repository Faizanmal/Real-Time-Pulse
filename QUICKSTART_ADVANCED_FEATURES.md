# Quick Start Guide - Advanced Features

## 🚀 Getting Started in 5 Minutes

### Step 1: Start the Backend
```bash
cd backend-nest
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

Backend will run on `http://localhost:3000`

### Step 2: Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:3001` or `http://localhost:3000` (check console)

---

## 📍 Feature Access URLs

| Feature | URL | Description |
|---------|-----|-------------|
| **Main Dashboard** | `/dashboard` | Overview with feature cards |
| **Advanced Features Hub** | `/advanced-features` | All features in one place |
| **Industry Solutions** | `/advanced-features?tab=industry` | Healthcare, Finance, Retail templates |
| **AI Assistant** | `/advanced-features?tab=ai` | Natural language queries |
| **Workflows** | `/advanced-features?tab=workflows` | Automation management |
| **Compliance** | `/advanced-features?tab=compliance` | HIPAA, PCI-DSS, SOC2 tracking |
| **API Marketplace** | `/advanced-features?tab=marketplace` | 100+ integrations |
| **AR Viewer** | `/ar-viewer` | Augmented reality scenes |
| **Workflow Builder** | `/workflows/new` | Create new workflow |

---

## 🎯 Quick Feature Demo

### 1. Deploy an Industry Template
1. Go to `/advanced-features?tab=industry`
2. Browse templates (Healthcare, Finance, Retail)
3. Click "Deploy" on any template
4. Template is instantly deployed to your workspace

### 2. Ask AI a Question
1. Go to `/advanced-features?tab=ai`
2. Type: "What were my sales last month?"
3. Click "Ask" or press Enter
4. Get AI-powered insights instantly

### 3. Create a Workflow
1. Go to `/advanced-features?tab=workflows`
2. Click "Create Workflow"
3. Add Trigger → Add Action
4. Save and execute

### 4. Browse API Connectors
1. Go to `/advanced-features?tab=marketplace`
2. Search for "Salesforce" or "Stripe"
3. Click "Install"
4. Configure connection settings

### 5. Monitor Compliance
1. Go to `/advanced-features?tab=compliance`
2. View compliance scores for HIPAA, PCI-DSS, SOC2
3. Manage security incidents
4. Track data inventory

### 6. Create AR Scene
1. Go to `/ar-viewer`
2. Click "Create Scene"
3. Configure scene name and type
4. Start AR session

---

## 🔑 Key Components

### Backend Components
- **6 NestJS modules** (one per feature)
- **20+ Prisma models** (database schema)
- **45+ API endpoints** (RESTful APIs)
- **6 service classes** (business logic)
- **6 controller classes** (API routes)

### Frontend Components
- **7 React components** (UI features)
- **40+ TypeScript types** (type safety)
- **6 API clients** (API integration)
- **4 page routes** (navigation)

---

## 📊 Sample API Requests

### Industry Solutions
```bash
# Get all templates
GET http://localhost:3000/api/industry-solutions/templates

# Deploy template
POST http://localhost:3000/api/industry-solutions/deploy
{
  "templateId": "template-id",
  "portalId": "portal-id"
}
```

### AI Assistant
```bash
# Query AI
POST http://localhost:3000/api/advanced-ai/query
{
  "query": "What were my sales last month?",
  "context": {}
}
```

### Workflows
```bash
# Create workflow
POST http://localhost:3000/api/workflow-automation/workflows
{
  "name": "Daily Report",
  "trigger": { "type": "schedule", "config": { "cron": "0 9 * * *" } },
  "actions": [{ "type": "email", "config": { "to": "user@example.com" } }]
}
```

---

## 🎨 UI Screenshots

### Dashboard with Feature Cards
```
┌─────────────────────────────────────────┐
│ Enterprise Features                     │
├─────────────────────────────────────────┤
│ [Industry]  [AI]  [Workflows]          │
│ [Compliance] [Marketplace] [AR]        │
└─────────────────────────────────────────┘
```

### Advanced Features Hub
```
┌─────────────────────────────────────────┐
│ Tabs: Industry | AI | Workflows |      │
│       Compliance | Marketplace         │
├─────────────────────────────────────────┤
│ [Feature content based on active tab]  │
└─────────────────────────────────────────┘
```

### Workflow Builder
```
┌─────────────────────────────────────────┐
│ Workflow Name: [Daily Report]          │
├─────────────────────────────────────────┤
│ [Trigger: Schedule]                     │
│         ↓                               │
│ [Condition: If sales > $1000]          │
│         ↓                               │
│ [Action: Send Email]                    │
└─────────────────────────────────────────┘
```

---

## ⚙️ Configuration

### Environment Variables (.env)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/realtimepulse"

# JWT
JWT_SECRET="your-secret-key-here"

# Redis (optional)
REDIS_HOST="localhost"
REDIS_PORT=6379

# AI (optional)
OPENAI_API_KEY="your-openai-key"
```

---

## 🔧 Troubleshooting

### Common Issues

**Backend not starting?**
```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Regenerate Prisma client
npx prisma generate
```

**Frontend showing errors?**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Database connection error?**
```bash
# Check DATABASE_URL in .env
# Ensure PostgreSQL is accessible
psql -U user -d realtimepulse -c "SELECT 1;"
```

**TypeScript errors?**
```bash
# Regenerate types
npm run build

# Check tsconfig.json paths
```

---

## 📚 Additional Resources

- **Full Documentation**: [ADVANCED_FEATURES_COMPLETE.md](./ADVANCED_FEATURES_COMPLETE.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Reference**: [API_REFERENCE.md](./API_REFERENCE.md)
- **Business Strategy**: [BUSINESS_STRATEGY.md](./BUSINESS_STRATEGY.md)

---

## 🎉 You're Ready!

Your Real-Time Pulse platform is now equipped with:
- ✅ Industry-specific templates
- ✅ AI-powered insights
- ✅ Workflow automation
- ✅ Compliance monitoring
- ✅ API marketplace
- ✅ AR visualization

**Start building amazing analytics experiences!** 🚀
