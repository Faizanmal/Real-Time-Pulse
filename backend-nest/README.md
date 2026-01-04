# Real-Time Pulse - Backend API

Production-ready multi-tenant B2B SaaS backend built with NestJS, PostgreSQL, Prisma, and Redis.

## 🆕 New Enterprise Features

- **📤 Export System** - PDF, CSV, Excel exports for portals and widgets
- **🤖 AI-Powered Insights** - Automatic anomaly detection and recommendations
- **🚨 Smart Alerts** - Multi-channel notifications (Email, Slack, Webhooks)
- **🔌 Webhooks Platform** - Event-based integrations with signature verification

📚 **Full Documentation:** See [../README.md](../README.md) and [../PRODUCTION_READY.md](../PRODUCTION_READY.md)
## 🤝 Contributing

We welcome issues and feature requests! For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

Proprietary - All rights reserved

## 🚀 Features

- **Multi-tenant Architecture**: Complete workspace isolation with `workspace_id`
- **Authentication**: Email/password + Google OAuth with JWT
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for portal data caching and job queue
- **Job Queue**: BullMQ for background data fetching
- **Security**: Encrypted OAuth tokens, password hashing, rate limiting
- **Type Safety**: Full TypeScript with strict mode

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+

## 🛠️ Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables to set:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT signing (generate a secure random string)
- `ENCRYPTION_KEY`: 32-character key for encrypting OAuth tokens
- `REDIS_HOST`, `REDIS_PORT`: Redis connection details
- OAuth credentials for Google, Asana, ClickUp, Harvest

### 3. Database Setup

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations (create database schema)
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

### 4. Start Development Server

```bash
npm run start:dev
```

API will be available at `http://localhost:3000/api`

## 📦 Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── strategies/       # Passport strategies (JWT, Google OAuth)
│   ├── guards/          # Auth guards
│   ├── dto/             # Data transfer objects
│   └── auth.service.ts  # Auth business logic
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators (@CurrentUser, etc.)
│   ├── services/        # Encryption, etc.
│   └── interfaces/      # Shared TypeScript interfaces
├── config/              # Configuration files
├── prisma/              # Prisma service and module
└── main.ts              # Application entry point
```

## 🗄️ Database Schema

### Core Entities

- **User**: Users with email/password or OAuth
- **Workspace**: Multi-tenant workspaces (agencies)
- **Subscription**: Stripe billing and trial management
- **Portal**: Client dashboards
- **Widget**: Portal building blocks (charts, metrics, etc.)
- **Integration**: Connected third-party services (Asana, GA4, etc.)
- **CacheJob**: Background job tracking

## 🔒 Security

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with salt rounds of 12
- **OAuth Token Encryption**: AES-256-GCM encryption at rest
- **Helmet**: Security headers
- **CORS**: Configured for frontend origin

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📝 Available Scripts

- `npm run start`: Start production server
- `npm run start:dev`: Start development server with hot reload
- `npm run build`: Build for production
- `npm run format`: Format code with Prettier
- `npm run lint`: Lint and fix code
- `npm run test`: Run unit tests

## 🔧 Prisma Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio (GUI for database)
npx prisma studio
```

## 🌐 API Endpoints

### Authentication

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - Login with email/password
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `POST /api/auth/password-reset/request` - Request password reset
- `POST /api/auth/password-reset/confirm` - Confirm password reset
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/logout` - Logout (protected)

## 🚧 Development Status

- ✅ Database schema and Prisma setup
- ✅ Authentication module (email/password + Google OAuth)
- ✅ Multi-tenant architecture foundation
- ⏳ Workspace management endpoints
- ⏳ Portal CRUD endpoints
- ⏳ Widget system
- ⏳ Integration Hub (Asana, GA4, Harvest OAuth)
- ⏳ Redis cache layer
- ⏳ BullMQ job queue for data fetching
- ⏳ Stripe billing integration
- ⏳ Deployment configuration

## 📄 License

Proprietary - All rights reserved


## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
