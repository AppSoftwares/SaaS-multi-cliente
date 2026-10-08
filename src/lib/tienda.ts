import { createClient } from "@/lib/supabase/server";
import { DEMO, demoProductosTienda } from "@/lib/demo";
import { NEGOCIO_TIENDA_ID } from "@/lib/tienda-config";
import type { ProductoTienda } from "@/lib/types";

export async function cargarProductosPublicos(): Promise<ProductoTienda[]> {
  if (DEMO) return demoProductosTienda;
  const supabase = await createClient();
  const { data } = await supabase
    .from("productos_tienda")
    .select("id, nombre, descripcion, categoria, precio_usd, imagen_url, destacado, orden")
    .eq("negocio_id", NEGOCIO_TIENDA_ID)
    .eq("activo", true)
    .order("orden");
  return (data ?? []) as ProductoTienda[];
}
