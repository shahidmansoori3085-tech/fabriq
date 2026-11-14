/**
 * The Supabase connection for cloud save. Off (null) until the project's
 * address and public key are set in the app's environment — then the app
 * works exactly as before, on the phone only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
export function cloud(): SupabaseClient | null {
  if (!URL || !KEY || typeof window === "undefined") return null;
  client ??= createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
  return client;
}
export const cloudOn = () => !!URL && !!KEY;
