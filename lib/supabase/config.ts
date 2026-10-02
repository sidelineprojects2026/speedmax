/**
 * Supabase configuration.
 *
 * The project is not connected yet (see the plan's Open items), so every entry
 * point checks `isSupabaseConfigured` before constructing a client. That keeps
 * the marketing site fully functional without a database instead of crashing
 * on a missing environment variable, and makes the "not configured" path an
 * explicit, visible state rather than an unhandled exception.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
}
