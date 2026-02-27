import crypto from "node:crypto";
import { pgPool } from "@/lib/pg";
import { createServerClient } from "@/lib/supabase";

export type PrivacyRequestMode = "delete" | "anonymize";

type SupabaseWithUserId =
  | "teams"
  | "reports"
  | "reps"
  | "rep_metrics"
  | "user_subscriptions";

const SUPABASE_USER_TABLES: SupabaseWithUserId[] = [
  "rep_metrics",
  "reports",
  "reps",
  "teams",
  "user_subscriptions",
];

async function listSupabaseRowsByUserId(userId: string, table: SupabaseWithUserId) {
  const supabase = createServerClient();
  const { data, error } = await supabase.from(table).select("*").eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to export ${table}: ${error.message}`);
  }

  return data ?? [];
}

async function deleteSupabaseRowsByUserId(userId: string, table: SupabaseWithUserId) {
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete ${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function listPgRowsByOrgIds(table: string, orgIds: string[]) {
  if (orgIds.length === 0) return [];
  const result = await pgPool.query(`SELECT * FROM ${table} WHERE org_id = ANY($1::uuid[])`, [orgIds]);
  return result.rows;
}

export async function exportUserData(userId: string) {
  const [
    teams,
    reports,
    reps,
    repMetrics,
    subscriptions,
    ownedOrgsResult,
    membershipResult,
    memberOrgResult,
  ] = await Promise.all([
    listSupabaseRowsByUserId(userId, "teams"),
    listSupabaseRowsByUserId(userId, "reports"),
    listSupabaseRowsByUserId(userId, "reps"),
    listSupabaseRowsByUserId(userId, "rep_metrics"),
    listSupabaseRowsByUserId(userId, "user_subscriptions"),
    pgPool.query("SELECT * FROM orgs WHERE owner_user_id = $1", [userId]),
    pgPool.query("SELECT * FROM org_memberships WHERE user_id = $1", [userId]),
    pgPool.query(
      `
        SELECT DISTINCT o.*
        FROM orgs o
        INNER JOIN org_memberships m ON m.org_id = o.id
        WHERE m.user_id = $1
      `,
      [userId],
    ),
  ]);

  const orgIds = Array.from(
    new Set([
      ...ownedOrgsResult.rows.map((row) => row.id as string),
      ...memberOrgResult.rows.map((row) => row.id as string),
    ]),
  );

  const [locations, leads, conversations, messages, appointments, jobs, auditLog, killSwitches] =
    await Promise.all([
      listPgRowsByOrgIds("locations", orgIds),
      listPgRowsByOrgIds("leads", orgIds),
      listPgRowsByOrgIds("conversations", orgIds),
      listPgRowsByOrgIds("messages", orgIds),
      listPgRowsByOrgIds("appointments", orgIds),
      listPgRowsByOrgIds("jobs", orgIds),
      listPgRowsByOrgIds("audit_log", orgIds),
      listPgRowsByOrgIds("kill_switch", orgIds),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    userId,
    reportsWorkspace: {
      teams,
      reports,
      reps,
      repMetrics,
      subscriptions,
    },
    goldbotWorkspace: {
      ownedOrgs: ownedOrgsResult.rows,
      memberships: membershipResult.rows,
      orgs: memberOrgResult.rows,
      locations,
      leads,
      conversations,
      messages,
      appointments,
      jobs,
      auditLog,
      killSwitches,
    },
  };
}

async function anonymizePgUserData(userId: string) {
  const anonymizedUserId = `deleted_${crypto
    .createHash("sha256")
    .update(`${userId}:${Date.now()}`)
    .digest("hex")
    .slice(0, 20)}`;

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const ownedOrgs = await client.query<{ id: string }>(
      "SELECT id FROM orgs WHERE owner_user_id = $1",
      [userId],
    );
    const ownedOrgIds = ownedOrgs.rows.map((row) => row.id);

    let leadsUpdated = 0;
    let messagesUpdated = 0;
    let appointmentsUpdated = 0;
    if (ownedOrgIds.length > 0) {
      const leadsResult = await client.query(
        `
          UPDATE leads
          SET
            full_name = 'Deleted Lead',
            first_name = 'Deleted',
            phone = '[deleted]',
            normalized_phone = concat('deleted-', substr(id::text, 1, 8)),
            metadata_json = '{}'::jsonb,
            updated_at = now()
          WHERE org_id = ANY($1::uuid[])
        `,
        [ownedOrgIds],
      );
      leadsUpdated = leadsResult.rowCount ?? 0;

      const messagesResult = await client.query(
        `
          UPDATE messages
          SET
            body = '[deleted]',
            metadata_json = '{}'::jsonb,
            error_message = NULL
          WHERE org_id = ANY($1::uuid[])
        `,
        [ownedOrgIds],
      );
      messagesUpdated = messagesResult.rowCount ?? 0;

      const appointmentsResult = await client.query(
        `
          UPDATE appointments
          SET
            notes = '[deleted]',
            metadata_json = '{}'::jsonb
          WHERE org_id = ANY($1::uuid[])
        `,
        [ownedOrgIds],
      );
      appointmentsUpdated = appointmentsResult.rowCount ?? 0;
    }

    const orgResult = await client.query(
      `
        UPDATE orgs
        SET
          owner_user_id = $2,
          name = concat('Deleted Org ', substr(id::text, 1, 8)),
          slug = NULL,
          updated_at = now()
        WHERE owner_user_id = $1
      `,
      [userId, anonymizedUserId],
    );

    const ownedMembershipResult = await client.query(
      `
        UPDATE org_memberships
        SET
          user_id = $2,
          status = 'suspended',
          updated_at = now()
        WHERE user_id = $1
          AND org_id = ANY($3::uuid[])
      `,
      [userId, anonymizedUserId, ownedOrgIds],
    );

    const externalMembershipResult = await client.query(
      `
        DELETE FROM org_memberships
        WHERE user_id = $1
          AND (cardinality($2::uuid[]) = 0 OR org_id <> ALL($2::uuid[]))
      `,
      [userId, ownedOrgIds],
    );

    await client.query("COMMIT");

    return {
      anonymizedUserId,
      orgsAnonymized: orgResult.rowCount ?? 0,
      membershipsAnonymized: ownedMembershipResult.rowCount ?? 0,
      membershipsDeleted: externalMembershipResult.rowCount ?? 0,
      leadsAnonymized: leadsUpdated,
      messagesAnonymized: messagesUpdated,
      appointmentsAnonymized: appointmentsUpdated,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deletePgUserData(userId: string) {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const deletedOwnedOrgs = await client.query(
      "DELETE FROM orgs WHERE owner_user_id = $1 RETURNING id",
      [userId],
    );

    const deletedMemberships = await client.query(
      "DELETE FROM org_memberships WHERE user_id = $1",
      [userId],
    );

    await client.query("COMMIT");

    return {
      orgsDeleted: deletedOwnedOrgs.rowCount ?? 0,
      membershipsDeleted: deletedMemberships.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteSupabaseUserData(userId: string) {
  const counts: Record<SupabaseWithUserId, number> = {
    teams: 0,
    reports: 0,
    reps: 0,
    rep_metrics: 0,
    user_subscriptions: 0,
  };

  for (const table of SUPABASE_USER_TABLES) {
    counts[table] = await deleteSupabaseRowsByUserId(userId, table);
  }

  return counts;
}

export async function anonymizeUserData(userId: string) {
  const [pgSummary, supabaseSummary] = await Promise.all([
    anonymizePgUserData(userId),
    deleteSupabaseUserData(userId),
  ]);

  return {
    mode: "anonymize" as const,
    pg: pgSummary,
    supabase: supabaseSummary,
  };
}

export async function deleteUserData(userId: string) {
  const [pgSummary, supabaseSummary] = await Promise.all([
    deletePgUserData(userId),
    deleteSupabaseUserData(userId),
  ]);

  return {
    mode: "delete" as const,
    pg: pgSummary,
    supabase: supabaseSummary,
  };
}

export async function processPrivacyRequest(userId: string, mode: PrivacyRequestMode) {
  if (mode === "anonymize") {
    return anonymizeUserData(userId);
  }

  return deleteUserData(userId);
}
