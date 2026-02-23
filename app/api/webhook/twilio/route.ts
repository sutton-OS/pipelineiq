import { NextResponse } from "next/server";
import { createInboundMessageFromWebhook } from "@/lib/goldbot";
import { validateTwilioSignature } from "@/lib/twilio-signature";

function shouldVerifySignature(): boolean {
  if (process.env.TWILIO_VERIFY_SIGNATURE === "false") {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    return true;
  }

  return process.env.TWILIO_VERIFY_SIGNATURE === "true";
}

export async function POST(request: Request) {
  const formData = await request.formData();

  if (shouldVerifySignature()) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = request.headers.get("x-twilio-signature");
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL || request.url;

    if (!authToken) {
      return NextResponse.json(
        { error: "TWILIO_AUTH_TOKEN is required for webhook verification" },
        { status: 500 },
      );
    }

    const isValid = validateTwilioSignature({
      authToken,
      signatureHeader: signature,
      url: webhookUrl,
      formData,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
  }

  const from = String(formData.get("From") ?? "").trim();
  const body = String(formData.get("Body") ?? "").trim();
  const messageSid = String(formData.get("MessageSid") ?? "").trim();

  if (!from || !body) {
    return NextResponse.json({ error: "From and Body are required" }, { status: 400 });
  }

  try {
    const payload = Object.fromEntries(formData.entries());

    const result = await createInboundMessageFromWebhook({
      fromPhone: from,
      body,
      providerMessageId: messageSid || undefined,
      rawPayload: payload,
    });

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      queuedJobId: result.queuedJobId,
      leadId: result.leadId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process inbound webhook";
    const status = message.includes("No lead") ? 404 : message.includes("Ambiguous") ? 409 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
