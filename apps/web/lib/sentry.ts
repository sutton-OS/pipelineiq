import { randomUUID } from "node:crypto";

type SentryTarget = {
  dsn: string;
  envelopeUrl: string;
};

function parseDsn(rawDsn: string): SentryTarget | null {
  try {
    const parsed = new URL(rawDsn);
    const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);

    if (!parsed.username || !projectId) {
      return null;
    }

    const pathPrefixParts = parsed.pathname.split("/").filter(Boolean).slice(0, -1);
    const pathPrefix = pathPrefixParts.length > 0 ? `/${pathPrefixParts.join("/")}` : "";
    const envelopeUrl = `${parsed.protocol}//${parsed.host}${pathPrefix}/api/${projectId}/envelope/`;

    return {
      dsn: rawDsn,
      envelopeUrl,
    };
  } catch {
    return null;
  }
}

function normalizeError(error: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Unknown error",
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

export function captureSentryServerException(
  route: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): string | null {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return null;
  }

  const target = parseDsn(dsn);
  if (!target) {
    return null;
  }

  const eventId = randomUUID().replaceAll("-", "");
  const normalized = normalizeError(error);
  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    level: "error",
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    platform: "node",
    logger: "pipelineiq.web",
    tags: {
      service: "web",
      route,
    },
    extra: {
      ...extra,
      stack: normalized.stack,
    },
    exception: {
      values: [
        {
          type: normalized.name,
          value: normalized.message,
        },
      ],
    },
  };

  const envelope = [
    JSON.stringify({
      sent_at: new Date().toISOString(),
      dsn: target.dsn,
    }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(payload),
  ].join("\n");

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 2000);

  void fetch(target.envelopeUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-sentry-envelope",
    },
    body: envelope,
    signal: abortController.signal,
  })
    .catch(() => {
      // Sentry emission should never fail request handling.
    })
    .finally(() => {
      clearTimeout(timeout);
    });

  return eventId;
}
