import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CapturaCliente } from "@/components/captura/captura-cliente";
import { DEMO, demoCatalogos, demoProveedores } from "@/lib/demo";
import type { Catalogos, Proveedor } from "@/lib/types";

export default async function CapturarPage() {
  const sesion = await getSesion();

  let catalogos: Catalogos = { categorias: [], marcas: [], unidades: [] };
  let proveedores: Proveedor[] = [];
  if (DEMO) {
    catalogos = demoCatalogos;
    proveedores = demoProveedores;
  } else {
    const supabase = await createClient();
    const [cats, marcas, unidades, provs] = await Promise.all([
      supabase.from("categorias").select("id, nombre, parent_id").order("nombre"),
      supabase.from("marcas").select("id, nombre").order("nombre"),
      supabase.from("unidades").select("id, nombre").order("nombre"),
      supabase.from("proveedores").select("*").order("nombre"),
    ]);
    catalogos = {
      categorias: cats.data ?? [],
      marcas: marcas.data ?? [],
      unidades: unidades.data ?? [],
    };
    proveedores = (provs.data ?? []) as Proveedor[];
  }

  return (
    <CapturaCliente
      esAdmin={sesion?.rol === "ADMIN"}
      catalogos={catalogos}
      proveedores={proveedores}
      negocioId={sesion?.negocioId ?? ""}
    />
  );
}
