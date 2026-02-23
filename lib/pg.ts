import { Pool } from "pg";
import { requireEnv } from "@/lib/env";

requireEnv(["DATABASE_URL"], "pg");
const connectionString = process.env.DATABASE_URL!;

const globalForPg = globalThis as typeof globalThis & {
  __pipelineiqPgPool?: Pool;
};

export const pgPool =
  globalForPg.__pipelineiqPgPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalForPg.__pipelineiqPgPool = pgPool;
}
