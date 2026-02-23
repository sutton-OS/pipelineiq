import { auth } from "@clerk/nextjs/server";

export async function requireUserId(): Promise<string> {
  const authResult = await auth();

  if (authResult.userId) {
    return authResult.userId;
  }

  const devUserId = process.env.DEV_USER_ID;
  if (process.env.NODE_ENV !== "production" && devUserId) {
    return devUserId;
  }

  throw new Error("Unauthorized");
}
