function errorDetails(error: unknown): {
  message: string;
  stack: string | undefined;
  cause: unknown;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  return {
    message: String(error),
    stack: undefined,
    cause: undefined,
  };
}

export function createReferenceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function logServerError(
  route: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): string {
  const referenceId = createReferenceId();
  const details = errorDetails(error);

  console.error("[server_error]", {
    route,
    referenceId,
    message: details.message,
    stack: details.stack,
    cause: details.cause,
    ...extra,
  });

  return referenceId;
}
