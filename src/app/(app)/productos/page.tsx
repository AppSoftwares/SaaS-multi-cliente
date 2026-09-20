import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { filtrosBusqueda, coincidePalabras } from "@/lib/utils";
import { BuscadorProductos } from "@/components/buscador-productos";
import { ListaProductos, type FiltrosLista } from "@/components/productos/lista-productos";
import { DEMO, demoProductos, demoCatalogos } from "@/lib/demo";
import type { Catalogos, Producto } from "@/lib/types";

const POR_PAGINA = 50;
const COLUMNAS =
  "id, negocio_id, nombre, sku, codigo_barras, categoria, categoria_id, marca, imagen_url, cantidad, stock_minimo, unidad_medida, precio_venta, precio_venta_bs";

type Params = { q?: string; f?: string; cat?: string; marca?: string; unidad?: string; p?: string; e?: string };

export default async function ProductosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sesion = await getSesion();
  const esAdmin = sesion?.rol === "ADMIN";

  const filtros: FiltrosLista = {
    q: sp.q?.trim() ?? "",
    f: sp.f === "sinprecio" || sp.f === "sincat" || sp.f === "sinmarca" ? sp.f : "",
    cat: sp.cat ?? "",
    marca: sp.marca ?? "",
    unidad: sp.unidad ?? "",
    edicion: esAdmin && sp.e === "1",
  };
  const pagina = Math.max(1, Number(sp.p) || 1);

  let productos: Producto[];
  let total: number;
  let conteos = { sinPrecio: 0, sinCategoria: 0, sinMarca: 0 };
  let catalogos: Catalogos = { categorias: [], marcas: [], unidades: [] };

  if (DEMO) {
    catalogos = demoCatalogos;
    const filtrados = demoProductos.filter(
      (p) =>
        (!filtros.q || coincidePalabras(`${p.nombre} ${p.sku ?? ""} ${p.codigo_barras ?? ""}`, filtros.q)) &&
        (filtros.f !== "sinprecio" || p.precio_venta === 0) &&
        (filtros.f !== "sincat" || !p.categoria) &&
        (filtros.f !== "sinmarca" || !p.marca) &&
        (!filtros.marca || p.marca === filtros.marca) &&
        (!filtros.unidad || p.unidad_medida === filtros.unidad)
    );
    total = filtrados.length;
    productos = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
    conteos = {
      sinPrecio: demoProductos.filter((p) => p.precio_venta === 0).length,
      sinCategoria: demoProductos.filter((p) => !p.categoria).length,
      sinMarca: demoProductos.filter((p) => !p.marca).length,
    };
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

    let query = supabase.from("productos").select(COLUMNAS, { count: "exact" });
    for (const f of filtrosBusqueda(filtros.q)) query = query.or(f);
    if (filtros.f === "sinprecio") query = query.eq("precio_venta", 0);
    if (filtros.f === "sincat") query = query.is("categoria", null);
    if (filtros.f === "sinmarca") query = query.or("marca.is.null,marca.eq.");
    if (filtros.marca) query = query.eq("marca", filtros.marca);
    if (filtros.unidad) query = query.eq("unidad_medida", filtros.unidad);
    if (filtros.cat) {
      // Una categoría madre incluye a todas sus subcategorías.
      const ids = [
        filtros.cat,
        ...catalogos.categorias.filter((c) => c.parent_id === filtros.cat).map((c) => c.id),
      ];
      query = query.in("categoria_id", ids);
    }

    const desde = (pagina - 1) * POR_PAGINA;
    const [lista, sinPrecio, sinCategoria, sinMarca] = await Promise.all([
      query.order("nombre").range(desde, desde + POR_PAGINA - 1),
      supabase.from("productos").select("id", { count: "exact", head: true }).eq("precio_venta", 0),
      supabase.from("productos").select("id", { count: "exact", head: true }).is("categoria", null),
      supabase.from("productos").select("id", { count: "exact", head: true }).or("marca.is.null,marca.eq."),
    ]);

    productos = (lista.data ?? []) as Producto[];
    total = lista.count ?? productos.length;
    conteos = {
      sinPrecio: sinPrecio.count ?? 0,
      sinCategoria: sinCategoria.count ?? 0,
      sinMarca: sinMarca.count ?? 0,
    };

    if (esAdmin && productos.length > 0) {
      const { data: costos } = await supabase
        .from("productos_costos")
        .select("producto_id, precio_costo")
        .in(
          "producto_id",
          productos.map((p) => p.id)
        );
      const mapa = new Map((costos ?? []).map((c) => [c.producto_id as string, c.precio_costo as number]));
      productos = productos.map((p) => ({ ...p, precio_costo: mapa.get(p.id) ?? null }));
    }
  }

  return (
    <div className="space-y-4 animate-in-up">
      <h1 className="text-2xl font-bold text-gradient">Productos</h1>
      <BuscadorProductos />
      <ListaProductos
        productos={productos}
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        conteos={conteos}
        filtros={filtros}
        catalogos={catalogos}
        esAdmin={esAdmin}
        negocioId={sesion?.negocioId ?? ""}
      />
    </div>
  );
}
