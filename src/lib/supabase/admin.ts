import { createClient } from "@supabase/supabase-js";

// Cliente con service-role. SOLO servidor (nunca importar en código cliente).
// Se salta RLS y permite operaciones de administración (crear/eliminar usuarios).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
