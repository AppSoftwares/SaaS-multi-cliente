import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEMO } from "@/lib/demo";
import { GestionCatalogos, type ConteosCatalogo } from "@/components/catalogos/gestion-catalogos";

// PostgREST devuelve máx. 1000 filas por consulta: se leen por tramos en paralelo.
async function conteosPorCatalogo(): Promise<ConteosCatalogo> {
  const vacio: ConteosCatalogo = { categoria: {}, marca: {}, unidad: {} };
  if (DEMO) return vacio;

  const supabase = await createClient();
  const { count } = await supabase.from("productos").select("id", { count: "exact", head: true });
  const total = count ?? 0;
  const TRAMO = 1000;
  const tramos = await Promise.all(
    Array.from({ length: Math.ceil(total / TRAMO) }, (_, i) =>
      supabase
        .from("productos")
        .select("categoria_id, marca, unidad_medida")
        .order("id")
        .range(i * TRAMO, i * TRAMO + TRAMO - 1)
    )
  );

  const res = vacio;
  for (const t of tramos) {
    for (const r of t.data ?? []) {
      if (r.categoria_id) res.categoria[r.categoria_id] = (res.categoria[r.categoria_id] ?? 0) + 1;
      if (r.marca) res.marca[r.marca] = (res.marca[r.marca] ?? 0) + 1;
      if (r.unidad_medida) res.unidad[r.unidad_medida] = (res.unidad[r.unidad_medida] ?? 0) + 1;
    }
  }
  return res;
}

export default async function CatalogosPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "ADMIN" || !sesion.negocioId) redirect("/");

  const conteos = await conteosPorCatalogo();

  return (
    <div className="space-y-4 animate-in-up">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Categorías, marcas y unidades</h1>
        <p className="text-sm text-muted-foreground">
          Toca una categoría, marca o unidad para ver los productos que tiene asignados.
        </p>
      </div>
      <GestionCatalogos negocioId={sesion.negocioId} conteos={conteos} />
    </div>
  );
}
