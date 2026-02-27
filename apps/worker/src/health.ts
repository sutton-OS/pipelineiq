import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pingRedis } from "./redisHealth";

type DependencyCheck = {
  ok: boolean;
  latencyMs: number | null;
  detail?: string;
};

function toJson(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function checkDatabase(): Promise<DependencyCheck> {
  const startedAt = Date.now();

  try {
    const { pool } = await import("./db");
    await pool.query("SELECT 1");
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function healthPortFromEnv(): number {
  const value = Number(process.env.WORKER_HEALTH_PORT ?? "8081");
  if (!Number.isInteger(value) || value <= 0) {
    return 8081;
  }
  return value;
}

export type WorkerHealthServer = {
  setReady: (nextReady: boolean) => void;
  close: () => Promise<void>;
};

export function startWorkerHealthServer(): WorkerHealthServer {
  const startedAt = Date.now();
  let ready = false;

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const method = request.method ?? "GET";
    const path = request.url ?? "/";

    if (method !== "GET") {
      toJson(response, 405, { ok: false, error: "Method Not Allowed" });
      return;
    }

    if (path === "/health/live") {
      toJson(response, 200, {
        ok: true,
        service: "worker",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
      });
      return;
    }

    if (path === "/health/ready") {
      const [database, cache] = await Promise.all([checkDatabase(), pingRedis()]);
      const ok = ready && database.ok && cache.ok;

      toJson(response, ok ? 200 : 503, {
        ok,
        service: "worker",
        ready,
        timestamp: new Date().toISOString(),
        checks: {
          database,
          cache,
        },
      });
      return;
    }

    toJson(response, 404, { ok: false, error: "Not Found" });
  });

  const port = healthPortFromEnv();
  server.listen(port, "0.0.0.0", () => {
    console.log(`[worker] health endpoint listening on :${port}`);
  });

  return {
    setReady(nextReady: boolean) {
      ready = nextReady;
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
