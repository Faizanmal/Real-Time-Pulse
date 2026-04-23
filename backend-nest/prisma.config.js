import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: './prisma/schema.prisma',
  database: {
    url: databaseUrl,
  },
  // Some Prisma CLI commands (migrate) expect a 'datasource' key named 'url'
  // in the config. Provide it as a fallback to ensure tooling works.
  datasource: {
    url: databaseUrl,
  },
})
