import { defineConfig, env } from 'prisma/config';
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Prisma ORM v7+ moves datasource URLs out of `schema.prisma`.
// The CLI will load this file automatically when running in this directory.
//
// Note: Prisma loads this config file *before* automatically loading `.env`,
// so we explicitly load env files here to make `env('DATABASE_URL')` work.
for (const p of ['.env', 'apps/api/.env', 'prisma/.env', 'apps/api/prisma/.env']) {
  const abs = resolve(process.cwd(), p);
  if (existsSync(abs)) dotenvConfig({ path: abs });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});


