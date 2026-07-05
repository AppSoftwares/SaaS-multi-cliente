import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { formatUSD, formatBs, formatFecha } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProductoAcciones } from "@/components/producto-acciones";
import { DEMO, demoProductos, demoMovimientos, demoCatalogos } from "@/lib/demo";
import { ArrowLeft } from "lucide-react";
import type { Catalogos, Movimiento, Producto } from "@/lib/types";

const ETIQUETA: Record<string, string> = {
  INGRESO: "Ingreso",
  VENTA: "Venta/Salida",
  AJUSTE: "Ajuste",
  ALTA: "Alta",
};

export default async function ProductoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await getSesion();
  const esAdmin = sesion?.rol === "ADMIN";

  let producto: Producto;
  let movimientos: Movimiento[];
  let catalogos: Catalogos = { categorias: [], marcas: [], unidades: [] };

  if (DEMO) {
    const p = demoProductos.find((x) => x.id === id);
    if (!p) notFound();
    producto = p;
    movimientos = demoMovimientos.filter((m) => m.producto_id === id);
    catalogos = demoCatalogos;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("productos").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    producto = data as Producto;

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

    if (esAdmin) {
      const { data: costo } = await supabase
        .from("productos_costos")
        .select("precio_costo")
        .eq("producto_id", id)
        .maybeSingle();
      producto.precio_costo = costo?.precio_costo ?? null;
    }

    const { data: movs } = await supabase
      .from("movimientos_inventario")
      .select("*")
      .eq("producto_id", id)
      .order("created_at", { ascending: false })
      .limit(20);
    movimientos = (movs ?? []) as Movimiento[];
  }

  const margen =
    esAdmin && producto.precio_costo != null
      ? producto.precio_venta - producto.precio_costo
      : null;

  const bajo = producto.stock_minimo > 0 && producto.cantidad <= producto.stock_minimo;

  return (
    <div className="space-y-4 animate-in-up">
      <Link href="/productos" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Productos
      </Link>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3">
            {producto.imagen_url && (
              <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border">
                <Image src={producto.imagen_url} alt={producto.nombre} fill className="object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{producto.nombre}</h1>
              <p className="text-sm text-muted-foreground">
                {producto.categoria ?? "Sin categoría"}
              </p>
              <div className="mt-1">
                <Badge variant={bajo ? "destructive" : "secondary"}>
                  {producto.cantidad} {producto.unidad_medida}
                  {producto.stock_minimo > 0 ? ` · mín ${producto.stock_minimo}` : ""}
                </Badge>
              </div>
            </div>
          </div>

          {/* Precio a cobrar en bolívares */}
          {producto.precio_venta_bs > 0 && (
            <div className="rounded-xl glass p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">A cobrar</p>
                <p className="text-2xl font-bold text-gradient">{formatBs(producto.precio_venta_bs)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">En USD si preguntan</p>
                <p className="font-semibold text-brand-cyan">
                  {formatUSD(producto.precio_venta_usd_ajustado)}
                </p>
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Dato k="Precio venta (base)" v={formatUSD(producto.precio_venta)} />
            {esAdmin && <Dato k="Precio costo" v={formatUSD(producto.precio_costo)} />}
            {margen != null && <Dato k="Margen" v={formatUSD(margen)} />}
            <Dato k="Marca" v={producto.marca ?? "—"} />
            <Dato k="SKU" v={producto.sku ?? "—"} />
            <Dato k="Código barras" v={producto.codigo_barras ?? "—"} />
            <Dato k="Proveedor" v={producto.proveedor ?? "—"} />
            <Dato k="Ubicación" v={producto.ubicacion ?? "—"} />
          </dl>
        </CardContent>
      </Card>

      <ProductoAcciones
        producto={producto}
        esAdmin={esAdmin}
        catalogos={catalogos}
        negocioId={sesion?.negocioId ?? ""}
      />

      {/* Historial */}
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold mb-2">Historial</h2>
          {movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos.</p>
          ) : (
            <ul className="divide-y text-sm">
              {movimientos.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium">{ETIQUETA[m.tipo] ?? m.tipo}</span>
                    <span className="text-muted-foreground"> · {formatFecha(m.created_at)}</span>
                  </div>
                  <span
                    className={m.cantidad_afectada >= 0 ? "text-emerald-600" : "text-destructive"}
                  >
                    {m.cantidad_afectada >= 0 ? "+" : ""}
                    {m.cantidad_afectada} → {m.cantidad_resultante}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </>
  );
}
