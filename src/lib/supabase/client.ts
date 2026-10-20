import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para componentes cliente (navegador).
// Usa la anon key: todas las operaciones respetan RLS.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
  );
}
