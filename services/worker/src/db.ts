import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

function loadEnvFiles(): void {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const candidatePaths = [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
  ];

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      dotenv.config({ path: candidatePath });
      break;
    }
  }
}

loadEnvFiles();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({ connectionString });

export function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<R>> {
  return pool.query<R>(text, params);
}
