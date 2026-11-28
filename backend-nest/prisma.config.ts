import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Copy .env.example to .env in backend-nest and start the local services before running Prisma.',
  )
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
})
