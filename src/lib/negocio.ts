import { createClient } from "@/lib/supabase/server";

// Nombre del negocio para mostrar en tickets/cierres impresos.
export async function getNegocioNombre(negocioId: string | null): Promise<string> {
  if (!negocioId) return "Mi Negocio";
  const supabase = await createClient();
  const { data } = await supabase.from("negocios").select("nombre").eq("id", negocioId).maybeSingle();
  return data?.nombre ?? "Mi Negocio";
}
