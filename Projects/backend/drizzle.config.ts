import { defineConfig } from 'drizzle-kit'
import { existsSync } from 'node:fs'

// drizzle-kit does not load this package's .env automatically.
if (existsSync('.env')) process.loadEnvFile('.env')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Drizzle commands. Copy .env.example to .env first.')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
})
