import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CapturaCliente } from "@/components/captura/captura-cliente";
import { DEMO, demoCatalogos } from "@/lib/demo";
import type { Catalogos } from "@/lib/types";

export default async function CapturarPage() {
  const sesion = await getSesion();

  let catalogos: Catalogos = { categorias: [], marcas: [], unidades: [] };
  if (DEMO) {
    catalogos = demoCatalogos;
  } else {
    const supabase = await createClient();
    const [cats, marcas, unidades] = await Promise.all([
      supabase.from("categorias").select("id, nombre, parent_id").order("nombre"),
      supabase.from("marcas").select("id, nombre").order("nombre"),
      supabase.from("unidades").select("id, nombre").order("nombre"),
    ]);
    catalogos = {
      categorias: cats.data ?? [],
      marcas: marcas.data ?? [],
      unidades: unidades.data ?? [],
    };
  }

  return (
    <CapturaCliente
      esAdmin={sesion?.rol === "ADMIN"}
      catalogos={catalogos}
      negocioId={sesion?.negocioId ?? ""}
    />
  );
}
