const OPT_OUT_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);

export function normalizePhone(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length > 11) {
    return `+${digits}`;
  }

  return null;
}

export function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  const [first] = trimmed.split(/\s+/);
  return first || "there";
}

export function isOptOutMessage(body: string): boolean {
  const normalized = body.trim().toUpperCase().replace(/\s+/g, "");
  return OPT_OUT_KEYWORDS.has(normalized);
}

export function isAffirmativeMessage(body: string): boolean {
  const normalized = body.trim().toLowerCase();
  return ["y", "yes", "yeah", "yep", "sure", "ok", "okay"].includes(
    normalized,
  );
}

export function isNegativeMessage(body: string): boolean {
  const normalized = body.trim().toLowerCase();
  return ["n", "no", "nope", "nah", "not now"].includes(normalized);
}
