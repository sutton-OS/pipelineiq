const ENV_MISSING_MESSAGE_PATTERN = /\[env_missing\]\s+scope=[^\s]+\s+missing=([A-Z0-9_,-]+)/i;

export function getMissingEnvKeysFromError(message: string): string[] {
  const match = message.match(ENV_MISSING_MESSAGE_PATTERN);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

