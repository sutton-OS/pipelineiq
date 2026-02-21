import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const globalForPg = globalThis as typeof globalThis & {
  __pipelineiqPgPool?: Pool;
};

export const pgPool =
  globalForPg.__pipelineiqPgPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalForPg.__pipelineiqPgPool = pgPool;
}
