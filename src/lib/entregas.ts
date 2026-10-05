import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntregaPedido } from "@/lib/types";

// Entregas del negocio con sus productos y datos de la venta (RLS filtra por permiso).
export async function cargarEntregas(supabase: SupabaseClient, estados?: EntregaPedido["estado"][]) {
  let q = supabase
    .from("entregas")
    .select(
      "id, estado, nota, verificado_at, en_ruta_at, entregado_at, created_at, pedido:pedidos(id, numero_venta, cliente_nombre, cliente_apellido, cliente_telefono, direccion, costo_delivery, total_bs, pedido_items(nombre, cantidad))"
    )
    .order("created_at", { ascending: false })
    .limit(150);
  if (estados) q = q.in("estado", estados);
  const { data } = await q;
  return (data ?? []) as unknown as EntregaPedido[];
}
