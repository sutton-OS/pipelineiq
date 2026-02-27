import net from "node:net";
import tls from "node:tls";

export type RedisPingResult = {
  ok: boolean;
  configured: boolean;
  latencyMs: number | null;
  detail: string;
};

function encodeRespCommand(parts: string[]): string {
  const header = `*${parts.length}\r\n`;
  const body = parts
    .map((part) => {
      const bytes = Buffer.byteLength(part);
      return `$${bytes}\r\n${part}\r\n`;
    })
    .join("");

  return `${header}${body}`;
}

function createSocket(connection: URL): net.Socket | tls.TLSSocket {
  const host = connection.hostname;
  const port = Number(connection.port || "6379");

  if (connection.protocol === "rediss:") {
    const rejectUnauthorized = process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false";
    return tls.connect({
      host,
      port,
      servername: host,
      rejectUnauthorized,
    });
  }

  return net.createConnection({ host, port });
}

export async function pingRedis(
  redisUrl: string | undefined = process.env.REDIS_URL,
  timeoutMs = 1500,
): Promise<RedisPingResult> {
  if (!redisUrl) {
    return {
      ok: true,
      configured: false,
      latencyMs: null,
      detail: "REDIS_URL not configured",
    };
  }

  let connection: URL;
  try {
    connection = new URL(redisUrl);
  } catch {
    return {
      ok: false,
      configured: true,
      latencyMs: null,
      detail: "REDIS_URL is invalid",
    };
  }

  if (!["redis:", "rediss:"].includes(connection.protocol)) {
    return {
      ok: false,
      configured: true,
      latencyMs: null,
      detail: "REDIS_URL must use redis:// or rediss://",
    };
  }

  const username = connection.username ? decodeURIComponent(connection.username) : "";
  const password = connection.password ? decodeURIComponent(connection.password) : "";
  const commands: string[] = [];

  if (password) {
    if (username) {
      commands.push(encodeRespCommand(["AUTH", username, password]));
    } else {
      commands.push(encodeRespCommand(["AUTH", password]));
    }
  }
  commands.push(encodeRespCommand(["PING"]));

  const startedAt = Date.now();

  return new Promise((resolve) => {
    const socket = createSocket(connection);
    let finished = false;
    let buffer = "";

    const finish = (result: RedisPingResult) => {
      if (finished) {
        return;
      }
      finished = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.write(commands.join(""));
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (/-ERR|NOAUTH|WRONGPASS/i.test(buffer)) {
        finish({
          ok: false,
          configured: true,
          latencyMs: Date.now() - startedAt,
          detail: "Redis rejected PING/AUTH command",
        });
        return;
      }

      if (buffer.includes("+PONG")) {
        finish({
          ok: true,
          configured: true,
          latencyMs: Date.now() - startedAt,
          detail: "PONG",
        });
      }
    });

    socket.on("timeout", () => {
      finish({
        ok: false,
        configured: true,
        latencyMs: Date.now() - startedAt,
        detail: "Redis ping timed out",
      });
    });

    socket.on("error", (error) => {
      finish({
        ok: false,
        configured: true,
        latencyMs: Date.now() - startedAt,
        detail: error.message,
      });
    });

    socket.on("close", () => {
      if (!finished) {
        finish({
          ok: false,
          configured: true,
          latencyMs: Date.now() - startedAt,
          detail: "Redis connection closed unexpectedly",
        });
      }
    });
  });
}
