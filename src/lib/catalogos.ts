import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import type { Catalogos, Proveedor } from "@/lib/types";

interface Entrada {
  madre: string;
  sub: string;
  marca: string;
  unidad: string;
}

interface Resuelto {
  categoria_id: string | null;
  categoria: string | null;
  marca: string | null;
  unidad_medida: string;
}

const eq = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// Resuelve las selecciones del wizard contra los catálogos; crea las que no
// existan (categoría madre/sub, marca, unidad) y devuelve los valores finales.
export async function resolverCatalogos(
  negocioId: string,
  cat: Catalogos,
  entrada: Entrada
): Promise<Resuelto> {
  const madre = entrada.madre.trim();
  const sub = entrada.sub.trim();
  const marca = entrada.marca.trim();
  const unidad = entrada.unidad.trim() || "Unidad";
  const supabase = createClient();

  let categoria_id: string | null = null;
  let categoriaTexto: string | null = null;

  if (madre) {
    // Categoría madre
    let madreId = cat.categorias.find((c) => !c.parent_id && eq(c.nombre, madre))?.id ?? null;
    if (!madreId && !DEMO) {
      const { data } = await supabase
        .from("categorias")
        .insert({ negocio_id: negocioId, nombre: madre })
        .select("id")
        .single();
      madreId = data?.id ?? null;
    }

    if (sub && madreId) {
      let subId =
        cat.categorias.find((c) => c.parent_id === madreId && eq(c.nombre, sub))?.id ?? null;
      if (!subId && !DEMO) {
        const { data } = await supabase
          .from("categorias")
          .insert({ negocio_id: negocioId, nombre: sub, parent_id: madreId })
          .select("id")
          .single();
        subId = data?.id ?? null;
      }
      categoria_id = subId ?? madreId;
      categoriaTexto = `${madre} › ${sub}`;
    } else {
      categoria_id = madreId;
      categoriaTexto = madre;
    }
  }

  // Marca (lista simple)
  if (marca && !DEMO && !cat.marcas.some((m) => eq(m.nombre, marca))) {
    await supabase.from("marcas").insert({ negocio_id: negocioId, nombre: marca });
  }

  // Unidad
  if (unidad && !DEMO && !cat.unidades.some((u) => eq(u.nombre, unidad))) {
    await supabase.from("unidades").insert({ negocio_id: negocioId, nombre: unidad });
  }

  return {
    categoria_id,
    categoria: categoriaTexto,
    marca: marca || null,
    unidad_medida: unidad,
  };
}

// Resuelve el proveedor elegido en el wizard: si ya existe (por id o por
// nombre) devuelve su id; si es nuevo intenta crearlo (solo ADMIN por RLS —
// si la creación falla, se guarda igual el nombre como texto libre).
export async function resolverProveedor(
  negocioId: string,
  proveedores: Proveedor[],
  entrada: { proveedorId: string; nombreNuevo: string }
): Promise<{ proveedor_id: string | null; proveedor: string | null }> {
  if (entrada.proveedorId) {
    const p = proveedores.find((x) => x.id === entrada.proveedorId);
    return { proveedor_id: entrada.proveedorId, proveedor: p?.nombre ?? null };
  }

  const nombre = entrada.nombreNuevo.trim();
  if (!nombre) return { proveedor_id: null, proveedor: null };
  if (DEMO) return { proveedor_id: null, proveedor: nombre };

  const existente = proveedores.find((p) => eq(p.nombre, nombre));
  if (existente) return { proveedor_id: existente.id, proveedor: existente.nombre };

  const supabase = createClient();
  const { data } = await supabase
    .from("proveedores")
    .insert({ negocio_id: negocioId, nombre })
    .select("id")
    .single();
  return { proveedor_id: data?.id ?? null, proveedor: nombre };
}
