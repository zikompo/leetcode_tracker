/** Serve generated sample data instead of Supabase (tests, screenshots, trying it out). */
export const DEMO = process.env.LEETTRACK_DEMO === "1";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY);

/**
 * Extension ids allowed to receive a session from /connect-extension. When unset (local
 * development with an unpacked extension), the page asks the user to confirm the id instead.
 */
export const EXTENSION_IDS = (process.env.NEXT_PUBLIC_EXTENSION_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
