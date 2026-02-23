import { Buffer } from "node:buffer";

export type SendSmsInput = {
  to: string;
  body: string;
  idempotencyKey: string;
};

export type SendSmsResult = {
  providerMessageId: string;
  providerStatus: string;
  simulated: boolean;
};

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }

  return { accountSid, authToken, fromNumber };
}

export async function sendSmsViaTwilio(input: SendSmsInput): Promise<SendSmsResult> {
  const config = getTwilioConfig();

  if (!config) {
    const simulatedId = `sim_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    console.log("[provider:twilio] simulated send", {
      to: input.to,
      idempotencyKey: input.idempotencyKey,
      messageId: simulatedId,
    });

    return {
      providerMessageId: simulatedId,
      providerStatus: "queued",
      simulated: true,
    };
  }

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const body = new URLSearchParams({
    To: input.to,
    From: config.fromNumber,
    Body: input.body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey,
      },
      body,
    },
  );

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `[twilio_send_failed] status=${response.status} body=${responseText.slice(0, 400)}`,
    );
  }

  const parsed = JSON.parse(responseText) as {
    sid?: string;
    status?: string;
  };

  return {
    providerMessageId: parsed.sid ?? `twilio_${Date.now()}`,
    providerStatus: parsed.status ?? "queued",
    simulated: false,
  };
}
