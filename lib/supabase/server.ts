import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * Always the anon key, never the service role — every query runs as the signed-in
 * user so RLS is what enforces tenant and cost boundaries. Reaching for the
 * service role here would silently bypass the entire security model in §17.1,
 * which is precisely what §24.1 #16 exists to catch.
 *
 * Returns null when Supabase is not configured, so callers can render an
 * explicit unavailable state rather than throwing.
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware, so this is safe to ignore.
        }
      },
    },
  });
}
