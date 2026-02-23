import crypto from "node:crypto";

function sortFormEntries(formData: FormData): Array<[string, string]> {
  return Array.from(formData.entries())
    .map(([key, value]) => [key, String(value)] as [string, string])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function validateTwilioSignature(input: {
  authToken: string;
  signatureHeader: string | null;
  url: string;
  formData: FormData;
}): boolean {
  if (!input.signatureHeader) {
    return false;
  }

  const sortedParams = sortFormEntries(input.formData);
  let data = input.url;

  for (const [key, value] of sortedParams) {
    data += `${key}${value}`;
  }

  const expected = crypto
    .createHmac("sha1", input.authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signatureHeader));
}
