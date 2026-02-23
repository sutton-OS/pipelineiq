export function renderTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
    const value = values[key];
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  });
}

export function createActionKey(
  prefix: string,
  ...parts: Array<string | number | null | undefined>
): string {
  const safeParts = parts
    .map((part) => String(part ?? ""))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9:_-]+/g, "_"));

  return [prefix, ...safeParts].join(":");
}
