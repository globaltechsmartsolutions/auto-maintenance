import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    /**
     * Migrations run over the DIRECT connection, not the pooled one.
     *
     * DATABASE_URL points at Supabase's transaction-mode pooler (port 6543),
     * which is right for the application: short queries, many connections. It
     * is wrong for migrations. That pooler hands a different backend to each
     * statement, so the advisory lock Prisma takes for a migration is released
     * underneath it and prepared statements collide - the symptom is a run that
     * hangs and then reports `prepared statement "s1" already exists`.
     *
     * DIRECT_URL is the session-mode pooler (5432), where one connection stays
     * one backend for the whole migration.
     */
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
