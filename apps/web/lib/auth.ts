import { auth } from "@clerk/nextjs/server";
import { requireEnv } from "@/lib/env";
import { logServerError } from "@/lib/server-error";

export type AppRole = "owner" | "staff";

export type AuthContext = {
  userId: string;
  clerkOrgId: string | null;
  clerkOrgRole: string | null;
  role: AppRole;
  devFallback: boolean;
};

function roleFromClerkOrgRole(orgRole: string | null): AppRole {
  if (!orgRole) {
    return "owner";
  }

  const normalized = orgRole.toLowerCase();
  if (normalized.includes("admin") || normalized.includes("owner")) {
    return "owner";
  }

  return "staff";
}

export function isOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return roleFromClerkOrgRole(role) === "owner" || role === "owner";
}

export async function requireAuthContext(): Promise<AuthContext> {
  requireEnv(
    ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    "auth.clerk",
  );

  const authResult = await auth();

  if (authResult.userId) {
    return {
      userId: authResult.userId,
      clerkOrgId: authResult.orgId ?? null,
      clerkOrgRole: authResult.orgRole ?? null,
      role: roleFromClerkOrgRole(authResult.orgRole ?? null),
      devFallback: false,
    };
  }

  const devUserId = process.env.DEV_USER_ID;
  if (process.env.NODE_ENV !== "production" && devUserId) {
    return {
      userId: devUserId,
      clerkOrgId: null,
      clerkOrgRole: "owner",
      role: "owner",
      devFallback: true,
    };
  }

  throw new Error("Unauthorized");
}

export async function requireUserId(): Promise<string> {
  try {
    const authContext = await requireAuthContext();
    return authContext.userId;
  } catch (error) {
    logServerError("lib/auth.requireUserId", error);
    throw error;
  }
}
