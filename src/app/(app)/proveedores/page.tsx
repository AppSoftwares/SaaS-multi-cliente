import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProveedoresTabs } from "@/components/proveedores/proveedores-tabs";
import { DEMO, demoProveedores, demoCatalogos, demoFacturas } from "@/lib/demo";
import type { Catalogos, Factura, MapaPermisos, PagoProveedor, Proveedor } from "@/lib/types";
import { puede } from "@/lib/permisos";

async function permisosDelUsuario(): Promise<MapaPermisos> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mis_permisos");
  return ((data as { modulos?: MapaPermisos } | null)?.modulos ?? {}) as MapaPermisos;
}

export interface BorradorResumen {
  id: string;
  numero_factura: string | null;
  proveedor_nombre: string | null;
  moneda: "BS" | "USD";
  monto_total: number;
  updated_at: string;
  items_count: number;
}

export default async function ProveedoresPage() {
  const sesion = await getSesion();
  const permisos = DEMO ? {} : await permisosDelUsuario();
  // Quien puede editar facturas (ADMIN o rol de facturación) y quien solo las ve.
  const esAdmin = sesion?.rol === "ADMIN" || puede(permisos, "facturas", "editar");
  const puedeVerFacturas = esAdmin || puede(permisos, "facturas", "ver");

  let proveedores: Proveedor[];
  let catalogos: Catalogos = { categorias: [], marcas: [], unidades: [] };
  let facturas: (Factura & { proveedor_nombre?: string | null })[] = [];
  let pagos: PagoProveedor[] = [];
  let borradores: BorradorResumen[] = [];

  if (DEMO) {
    proveedores = demoProveedores;
    catalogos = demoCatalogos;
    facturas = demoFacturas;
  } else {
    const supabase = await createClient();
    const [provs, cats, marcas, unidades, facs, borradoresRes] = await Promise.all([
      supabase.from("proveedores").select("*").order("nombre"),
      esAdmin ? supabase.from("categorias").select("id, nombre, parent_id").order("nombre") : Promise.resolve({ data: [] }),
      esAdmin ? supabase.from("marcas").select("id, nombre").order("nombre") : Promise.resolve({ data: [] }),
      esAdmin ? supabase.from("unidades").select("id, nombre").order("nombre") : Promise.resolve({ data: [] }),
      puedeVerFacturas
        ? supabase
            .from("facturas")
            .select("*, proveedores(nombre)")
            .neq("estado", "borrador")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      puedeVerFacturas
        ? supabase
            .from("facturas")
            .select("id, numero_factura, moneda, monto_total, updated_at, proveedores(nombre), factura_items(count)")
            .eq("estado", "borrador")
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    proveedores = (provs.data ?? []) as Proveedor[];
    catalogos = {
      categorias: cats.data ?? [],
      marcas: marcas.data ?? [],
      unidades: unidades.data ?? [],
    };
    facturas = ((facs.data ?? []) as Array<Factura & { proveedores?: { nombre: string } | null }>).map((f) => ({
      ...f,
      proveedor_nombre: f.proveedores?.nombre ?? null,
    }));
    borradores = ((borradoresRes.data ?? []) as unknown as Array<{
      id: string;
      numero_factura: string | null;
      moneda: "BS" | "USD";
      monto_total: number;
      updated_at: string;
      proveedores: { nombre: string } | null;
      factura_items: { count: number }[];
    }>).map((f) => ({
      id: f.id,
      numero_factura: f.numero_factura,
      proveedor_nombre: f.proveedores?.nombre ?? null,
      moneda: f.moneda,
      monto_total: f.monto_total,
      updated_at: f.updated_at,
      items_count: f.factura_items?.[0]?.count ?? 0,
    }));

    if (puedeVerFacturas && facturas.length > 0) {
      const { data: pagosData } = await supabase
        .from("pagos_proveedor")
        .select("*")
        .in("factura_id", facturas.map((f) => f.id))
        .order("created_at", { ascending: false });
      pagos = (pagosData ?? []) as PagoProveedor[];
    }
  }

  return (
    <div className="space-y-4 animate-in-up">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          {esAdmin
            ? "Administra proveedores y registra sus facturas."
            : "Consulta los datos de contacto de tus proveedores."}
        </p>
      </div>
      <ProveedoresTabs
        negocioId={sesion?.negocioId ?? ""}
        esAdmin={esAdmin}
        puedeVerFacturas={puedeVerFacturas}
        proveedores={proveedores}
        facturas={facturas}
        pagos={pagos}
        catalogos={catalogos}
        borradores={borradores}
      />
    </div>
  );
}
