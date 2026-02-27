function isEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export const SHOW_EXPERIMENTAL_GOLDBOT_FEATURES = isEnabled(
  process.env.NEXT_PUBLIC_ENABLE_EXPERIMENTAL_GOLDBOT,
);
