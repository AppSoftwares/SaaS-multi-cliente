import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import type { Catalogos } from "@/lib/types";

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
