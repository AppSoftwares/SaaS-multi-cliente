import type { createClient } from "@/lib/supabase/server";

// Quién puede gestionar facturas de proveedor (analizar con IA, registrar,
// guardar borradores): ADMIN y cualquier rol con permiso de 'facturas' en
// 'editar' (hoy FACTURACION). Antes estas rutas exigían ADMIN a secas, lo
// que dejaba a FACTURACION sin poder usar la función para la que existe su
// rol (pedido del cliente, 2026-10-19).
export async function requirePermisoFacturas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<
  | { ok: true; negocioId: string; rol: string }
  | { ok: false; status: number; error: string }
> {
  const { data: rolRow } = await supabase
    .from("roles_usuario")
    .select("rol, negocio_id")
    .eq("id", userId)
    .maybeSingle();
  if (!rolRow?.negocio_id) {
    return { ok: false, status: 403, error: "Usuario sin negocio asignado" };
  }

  const { data: tienePermiso } = await supabase.rpc("tiene_permiso", {
    p_modulo: "facturas",
    p_nivel: "editar",
  });
  if (!tienePermiso) {
    return { ok: false, status: 403, error: "No tienes permiso para gestionar facturas" };
  }

  return { ok: true, negocioId: rolRow.negocio_id as string, rol: rolRow.rol as string };
}
