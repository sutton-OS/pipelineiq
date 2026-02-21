import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.string().default("development"),
});

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

async function main() {
  loadEnvFiles();

  const envResult = EnvSchema.safeParse(process.env);
  if (!envResult.success) {
    const badKeys = [
      ...new Set(
        envResult.error.issues
          .map((issue) => issue.path[0])
          .filter((key): key is string => typeof key === "string"),
      ),
    ];
    const keysLabel = badKeys.length > 0 ? badKeys.join(", ") : "DATABASE_URL";
    console.error(`[worker] Invalid environment keys: ${keysLabel}`);
    throw new Error("Invalid environment configuration");
  }

  const { NODE_ENV } = envResult.data;
  console.log(`[worker] starting (${NODE_ENV})`);

  const [{ pool }, { ensureSchema }, { runLoop }] = await Promise.all([
    import("./db"),
    import("./schema"),
    import("./runner"),
  ]);

  try {
    await pool.query("SELECT 1");
    console.log("[worker] database reachable");

    await ensureSchema();
    console.log("[worker] schema ready");

    await runLoop();
  } catch (error) {
    console.error("[worker] database unreachable");
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw error;
  }
}

void main().catch(() => {
  process.exit(1);
});
