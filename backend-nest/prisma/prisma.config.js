// Ensure .env is loaded when Prisma loads this config
try {
  require('dotenv').config();
} catch (e) {
  // ignore
}

// Removed to avoid Prisma CLI parse conflicts. Using explicit --url when running prisma commands.
