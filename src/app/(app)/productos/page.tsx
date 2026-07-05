import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/utils";
import { formatUSD } from "@/lib/format";
import { BuscadorProductos } from "@/components/buscador-productos";
import { Badge } from "@/components/ui/badge";
import { formatBs } from "@/lib/format";
import { DEMO, demoProductos } from "@/lib/demo";
import type { Producto } from "@/lib/types";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let productos: Producto[];

  if (DEMO) {
    const term = (q ?? "").toLowerCase();
    productos = demoProductos.filter(
      (p) =>
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        (p.sku ?? "").toLowerCase().includes(term) ||
        (p.codigo_barras ?? "").toLowerCase().includes(term)
    );
  } else {
    const supabase = await createClient();
    let query = supabase
      .from("productos")
      .select(
        "id, nombre, sku, codigo_barras, categoria, marca, imagen_url, cantidad, stock_minimo, unidad_medida, precio_venta, precio_venta_bs"
      )
      .order("nombre");

    if (q?.trim()) {
      const t = escapeLike(q.trim());
      query = query.or(`nombre.ilike.%${t}%,sku.ilike.%${t}%,codigo_barras.ilike.%${t}%`);
    }

    const { data } = await query.limit(200);
    productos = (data ?? []) as Producto[];
  }

  return (
    <div className="space-y-4 animate-in-up">
      <h1 className="text-2xl font-bold text-gradient">Productos</h1>
      <BuscadorProductos />

      {productos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay productos. Usa “Capturar” para agregar el primero.
        </p>
      ) : (
        <ul className="glass rounded-2xl divide-y divide-border/40 overflow-hidden">
          {productos.map((p, i) => {
            const bajo = p.stock_minimo > 0 && p.cantidad <= p.stock_minimo;
            return (
              <li key={p.id} className="stagger-item" style={{ "--i": i } as React.CSSProperties}>
                <Link
                  href={`/productos/${p.id}`}
                  className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-primary/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-muted/40 ring-1 ring-border">
                      {p.imagen_url ? (
                        <Image src={p.imagen_url} alt={p.nombre} fill className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-muted-foreground text-lg">
                          📦
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.marca ? `${p.marca} · ` : ""}
                        {p.categoria ?? "Sin categoría"} · {formatUSD(p.precio_venta)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {p.precio_venta_bs > 0 && (
                      <span className="text-xs font-semibold text-brand-cyan">
                        {formatBs(p.precio_venta_bs)}
                      </span>
                    )}
                    <Badge variant={bajo ? "destructive" : "secondary"}>
                      {p.cantidad} {p.unidad_medida}
                    </Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
