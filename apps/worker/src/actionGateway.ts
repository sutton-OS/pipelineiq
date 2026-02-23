import type { PoolClient } from "pg";
import { pool } from "./db";
import { bookAppointmentViaProvider } from "./providers/booking";
import { createActionKey } from "@pipelineiq/engine";
import type {
  ActionGatewayInput,
  ActionResult,
  ConversationContext,
  GovernorDecision,
  ProposedAction,
} from "@pipelineiq/engine";

type MutationResult = {
  details: Record<string, unknown>;
};

type JobPayloadInput = {
  orgId: string;
  locationId: string;
  type: string;
  runAt: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
};

async function insertAuditRow(
  client: PoolClient,
  args: {
    context: ConversationContext;
    jobId: string;
    policyVersion: string;
    decision: GovernorDecision;
    success: boolean;
    errorMessage: string | null;
    resultJson: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `
      INSERT INTO audit_log (
        org_id,
        location_id,
        lead_id,
        conversation_id,
        job_id,
        action_type,
        policy_version,
        request_json,
        decision_json,
        result_json,
        success,
        error_message
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::jsonb,
        $9::jsonb,
        $10::jsonb,
        $11,
        $12
      )
    `,
    [
      args.context.orgId,
      args.context.locationId,
      args.context.leadId,
      args.context.conversationId,
      Number(args.jobId),
      args.decision.normalizedAction.kind,
      args.policyVersion,
      JSON.stringify(args.decision.action),
      JSON.stringify({
        allowed: args.decision.allowed,
        reasons: args.decision.reasons,
        normalizedAction: args.decision.normalizedAction,
      }),
      JSON.stringify(args.resultJson),
      args.success,
      args.errorMessage,
    ],
  );
}

async function enqueueJob(client: PoolClient, input: JobPayloadInput): Promise<{ inserted: boolean; jobId: string | null }> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO jobs (
        org_id,
        location_id,
        type,
        dedupe_key,
        run_at,
        payload_json
      )
      VALUES ($1, $2, $3, $4, $5::timestamptz, $6::jsonb)
      ON CONFLICT (org_id, dedupe_key)
      DO NOTHING
      RETURNING id
    `,
    [
      input.orgId,
      input.locationId,
      input.type,
      input.dedupeKey ?? null,
      input.runAt,
      JSON.stringify(input.payload),
    ],
  );

  const insertedRow = result.rows[0];
  return {
    inserted: Boolean(insertedRow?.id),
    jobId: insertedRow?.id ?? null,
  };
}

async function applyConversationPatch(
  client: PoolClient,
  context: ConversationContext,
  action: Extract<ProposedAction, { kind: "conversation_patch" }>,
): Promise<MutationResult> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  const addAssignment = (clause: string, value: unknown) => {
    values.push(value);
    assignments.push(`${clause} = $${values.length}`);
  };

  if (action.state !== undefined) {
    addAssignment("state", action.state);
  }
  if (action.invalidResponseCount !== undefined) {
    addAssignment("invalid_response_count", action.invalidResponseCount);
  }
  if (action.needsStaffAttention !== undefined) {
    addAssignment("needs_staff_attention", action.needsStaffAttention);
  }
  if (action.staleAfterAt !== undefined) {
    addAssignment("stale_after_at", action.staleAfterAt);
  }
  if (action.lastInboundAt !== undefined) {
    addAssignment("last_inbound_at", action.lastInboundAt);
  }
  if (action.lastOutboundAt !== undefined) {
    addAssignment("last_outbound_at", action.lastOutboundAt);
  }

  if (action.flagsJsonMerge && Object.keys(action.flagsJsonMerge).length > 0) {
    values.push(JSON.stringify(action.flagsJsonMerge));
    assignments.push(`flags_json = COALESCE(flags_json, '{}'::jsonb) || $${values.length}::jsonb`);
  }

  assignments.push("last_transition_at = now()");
  assignments.push("updated_at = now()");

  values.push(context.conversationId);

  const result = await client.query(
    `
      UPDATE conversations
      SET ${assignments.join(", ")}
      WHERE id = $${values.length}
      RETURNING id
    `,
    values,
  );

  return {
    details: {
      updatedConversation: (result.rowCount ?? 0) > 0,
    },
  };
}

async function applySetOptOut(
  client: PoolClient,
  context: ConversationContext,
  action: Extract<ProposedAction, { kind: "set_opt_out" }>,
): Promise<MutationResult> {
  const leadResult = await client.query(
    `
      UPDATE leads
      SET
        opted_out = true,
        consent_status = 'revoked',
        opted_out_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING id
    `,
    [context.leadId],
  );

  await client.query(
    `
      UPDATE conversations
      SET
        needs_staff_attention = false,
        updated_at = now(),
        flags_json = COALESCE(flags_json, '{}'::jsonb) || $2::jsonb
      WHERE id = $1
    `,
    [context.conversationId, JSON.stringify({ optOutReason: action.reason, optOutAt: new Date().toISOString() })],
  );

  return {
    details: {
      updatedLead: (leadResult.rowCount ?? 0) > 0,
      reason: action.reason,
    },
  };
}

async function applyScheduleJob(
  client: PoolClient,
  context: ConversationContext,
  action: Extract<ProposedAction, { kind: "schedule_job" }>,
): Promise<MutationResult> {
  const enqueueResult = await enqueueJob(client, {
    orgId: context.orgId,
    locationId: context.locationId,
    type: action.jobType,
    runAt: action.runAt,
    payload: action.payload,
    dedupeKey: action.dedupeKey,
  });

  return {
    details: {
      queued: enqueueResult.inserted,
      jobId: enqueueResult.jobId,
      dedupeKey: action.dedupeKey ?? null,
    },
  };
}

async function applyBookAppointment(
  client: PoolClient,
  context: ConversationContext,
  action: Extract<ProposedAction, { kind: "book_appointment" }>,
): Promise<MutationResult> {
  const existingAppointmentResult = await client.query<{
    id: string;
    starts_at: string;
    provider: string | null;
    provider_appointment_id: string | null;
    provider_payload_json: unknown;
  }>(
    `
      SELECT
        id,
        starts_at,
        provider,
        provider_appointment_id,
        provider_payload_json
      FROM appointments
      WHERE org_id = $1
        AND idempotency_key = $2
      LIMIT 1
    `,
    [context.orgId, action.idempotencyKey],
  );

  const existingAppointment = existingAppointmentResult.rows[0];
  const providerResult =
    existingAppointment?.provider_appointment_id && existingAppointment.provider
      ? {
          provider: existingAppointment.provider,
          providerAppointmentId: existingAppointment.provider_appointment_id,
          status: "existing",
          simulated: false,
          providerPayload:
            existingAppointment.provider_payload_json &&
            typeof existingAppointment.provider_payload_json === "object" &&
            !Array.isArray(existingAppointment.provider_payload_json)
              ? (existingAppointment.provider_payload_json as Record<string, unknown>)
              : {},
        }
      : await bookAppointmentViaProvider({
          provider: context.locationConfig.bookingProvider,
          bookingSettings: context.locationConfig.bookingSettings,
          orgId: context.orgId,
          locationId: context.locationId,
          conversationId: context.conversationId,
          leadId: context.leadId,
          leadName: context.leadFullName,
          leadPhone: context.leadPhone,
          timezone: context.locationConfig.timezone,
          startsAt: action.startsAt,
          endsAt: action.endsAt,
          notes: action.notes,
          metadata: action.metadata,
          idempotencyKey: action.idempotencyKey,
        });

  const appointmentResult = await client.query<{
    id: string;
    starts_at: string;
    provider: string | null;
    provider_appointment_id: string | null;
  }>(
    `
      INSERT INTO appointments (
        org_id,
        location_id,
        lead_id,
        conversation_id,
        starts_at,
        ends_at,
        status,
        idempotency_key,
        provider,
        provider_appointment_id,
        notes,
        metadata_json,
        provider_payload_json
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::timestamptz,
        $6::timestamptz,
        'booked',
        $7,
        $8,
        $9,
        $10,
        $11::jsonb,
        $12::jsonb
      )
      ON CONFLICT (org_id, idempotency_key)
      DO UPDATE SET
        notes = COALESCE(EXCLUDED.notes, appointments.notes),
        provider = COALESCE(appointments.provider, EXCLUDED.provider),
        provider_appointment_id = COALESCE(
          appointments.provider_appointment_id,
          EXCLUDED.provider_appointment_id
        ),
        provider_payload_json = CASE
          WHEN appointments.provider_payload_json = '{}'::jsonb
            THEN EXCLUDED.provider_payload_json
          ELSE appointments.provider_payload_json
        END
      RETURNING id, starts_at, provider, provider_appointment_id
    `,
    [
      context.orgId,
      context.locationId,
      context.leadId,
      context.conversationId,
      action.startsAt,
      action.endsAt,
      action.idempotencyKey,
      providerResult.provider,
      providerResult.providerAppointmentId,
      action.notes ?? null,
      JSON.stringify(action.metadata ?? {}),
      JSON.stringify(providerResult.providerPayload ?? {}),
    ],
  );

  const appointmentRow = appointmentResult.rows[0];
  const appointmentId = appointmentRow?.id ?? null;

  if (appointmentId && appointmentRow?.starts_at) {
    const reminderTime = new Date(
      new Date(appointmentRow.starts_at).getTime() - 2 * 60 * 60 * 1000,
    );

    await enqueueJob(client, {
      orgId: context.orgId,
      locationId: context.locationId,
      type: "reminder",
      runAt: reminderTime.toISOString(),
      dedupeKey: createActionKey("reminder", context.conversationId, appointmentId),
      payload: {
        orgId: context.orgId,
        locationId: context.locationId,
        leadId: context.leadId,
        conversationId: context.conversationId,
        appointmentId,
      },
    });
  }

  return {
    details: {
      appointmentId,
      startsAt: appointmentRow?.starts_at ?? null,
      provider: appointmentRow?.provider ?? providerResult.provider,
      providerAppointmentId:
        appointmentRow?.provider_appointment_id ?? providerResult.providerAppointmentId,
      providerStatus: providerResult.status,
      providerSimulated: providerResult.simulated,
    },
  };
}

async function applySendMessage(
  client: PoolClient,
  context: ConversationContext,
  action: Extract<ProposedAction, { kind: "send_message" }>,
): Promise<MutationResult> {
  const messageInsert = await client.query<{ id: string }>(
    `
      INSERT INTO messages (
        org_id,
        location_id,
        conversation_id,
        lead_id,
        direction,
        channel,
        body,
        status,
        idempotency_key,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, 'outbound', 'sms', $5, 'pending', $6, $7::jsonb)
      ON CONFLICT (org_id, idempotency_key)
      DO NOTHING
      RETURNING id
    `,
    [
      context.orgId,
      context.locationId,
      context.conversationId,
      context.leadId,
      action.body,
      action.idempotencyKey,
      JSON.stringify(action.metadata ?? {}),
    ],
  );

  const insertedMessageId = messageInsert.rows[0]?.id ?? null;
  const messageId =
    insertedMessageId ??
    (
      await client.query<{ id: string }>(
        `
          SELECT id
          FROM messages
          WHERE org_id = $1
            AND idempotency_key = $2
          LIMIT 1
        `,
        [context.orgId, action.idempotencyKey],
      )
    ).rows[0]?.id ?? null;

  if (!messageId) {
    throw new Error("failed_to_resolve_outbound_message");
  }

  await client.query(
    `
      UPDATE conversations
      SET
        last_outbound_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [context.conversationId],
  );

  await client.query(
    `
      UPDATE leads
      SET
        last_outbound_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [context.leadId],
  );

  const enqueueResult = await enqueueJob(client, {
    orgId: context.orgId,
    locationId: context.locationId,
    type: "send_outbound",
    runAt: new Date().toISOString(),
    dedupeKey: createActionKey("send_outbound", messageId),
    payload: {
      orgId: context.orgId,
      locationId: context.locationId,
      messageId,
    },
  });

  return {
    details: {
      messageId,
      inserted: Boolean(insertedMessageId),
      queuedSendJob: enqueueResult.inserted,
    },
  };
}

async function applyAllowedAction(
  client: PoolClient,
  context: ConversationContext,
  action: ProposedAction,
): Promise<MutationResult> {
  switch (action.kind) {
    case "conversation_patch":
      return applyConversationPatch(client, context, action);
    case "set_opt_out":
      return applySetOptOut(client, context, action);
    case "schedule_job":
      return applyScheduleJob(client, context, action);
    case "book_appointment":
      return applyBookAppointment(client, context, action);
    case "send_message":
      return applySendMessage(client, context, action);
    default:
      throw new Error(`Unsupported action kind ${(action as { kind?: string }).kind ?? "unknown"}`);
  }
}

export async function applyActionGateway(input: ActionGatewayInput): Promise<ActionResult[]> {
  const client = await pool.connect();
  const results: ActionResult[] = [];

  try {
    for (const decision of input.decisions) {
      if (!decision.allowed) {
        const blockedResult: ActionResult = {
          action: decision.normalizedAction,
          applied: false,
          skipped: true,
          details: { blockedReasons: decision.reasons },
        };

        await insertAuditRow(client, {
          context: input.context,
          jobId: input.jobId,
          policyVersion: input.policyVersion,
          decision,
          success: false,
          errorMessage: decision.reasons.join(", "),
          resultJson: blockedResult.details,
        });

        results.push(blockedResult);
        continue;
      }

      await client.query("BEGIN");
      try {
        const mutationResult = await applyAllowedAction(
          client,
          input.context,
          decision.normalizedAction,
        );

        await insertAuditRow(client, {
          context: input.context,
          jobId: input.jobId,
          policyVersion: input.policyVersion,
          decision,
          success: true,
          errorMessage: null,
          resultJson: mutationResult.details,
        });

        await client.query("COMMIT");

        results.push({
          action: decision.normalizedAction,
          applied: true,
          skipped: false,
          details: mutationResult.details,
        });
      } catch (error) {
        await client.query("ROLLBACK");

        const message = error instanceof Error ? error.message : String(error);

        await insertAuditRow(client, {
          context: input.context,
          jobId: input.jobId,
          policyVersion: input.policyVersion,
          decision,
          success: false,
          errorMessage: message,
          resultJson: { failedAction: decision.normalizedAction.kind },
        });

        throw error;
      }
    }

    return results;
  } finally {
    client.release();
  }
}
