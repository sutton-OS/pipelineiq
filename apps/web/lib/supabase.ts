import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

// Server client — uses service role key, bypasses RLS
// ONLY use this in Server Actions and Route Handlers, never in client components
export function createServerClient() {
  requireEnv(
    [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    "supabase.server",
  );

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Public client — for client components only
export function createPublicClient() {
  requireEnv(
    ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    "supabase.public",
  );

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
