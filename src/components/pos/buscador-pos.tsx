"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO, demoProductos } from "@/lib/demo";
import { Input } from "@/components/ui/input";
import { Search, Package } from "lucide-react";
import { escapeLike } from "@/lib/utils";
import { formatBs } from "@/lib/format";
import type { ProductoPos } from "@/lib/types";

// Búsqueda por nombre/SKU/código para agregar al carrito del POS. Estado
// local (no URL): el resultado se consume al click y el término se limpia.
export function BuscadorPos({ onSeleccionar }: { onSeleccionar: (p: ProductoPos) => void }) {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<ProductoPos[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const t = termino.trim();
    if (!t) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultados([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBuscando(true);
      if (DEMO) {
        const q = t.toLowerCase();
        setResultados(
          demoProductos
            .filter(
              (p) =>
                p.nombre.toLowerCase().includes(q) ||
                (p.sku ?? "").toLowerCase().includes(q) ||
                (p.codigo_barras ?? "").toLowerCase().includes(q)
            )
            .slice(0, 8)
        );
      } else {
        const supabase = createClient();
        const like = escapeLike(t);
        const { data } = await supabase
          .from("productos")
          .select(
            "id, nombre, codigo_barras, unidad_medida, cantidad, stock_minimo, precio_venta, precio_venta_bs, precio_venta_usd_ajustado, activo"
          )
          .eq("activo", true)
          .or(`nombre.ilike.%${like}%,sku.ilike.%${like}%,codigo_barras.ilike.%${like}%`)
          .order("nombre")
          .limit(8);
        setResultados(((data ?? []) as ProductoPos[]));
      }
      setBuscando(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [termino]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar producto por nombre, SKU o código…"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
        />
      </div>

      {termino.trim() && (
        <div className="absolute z-20 mt-1 w-full glass rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          {buscando ? (
            <p className="p-3 text-xs text-muted-foreground">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Sin resultados</p>
          ) : (
            resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSeleccionar(p);
                  setTermino("");
                  setResultados([]);
                }}
                className="flex w-full items-center justify-between gap-2 p-2.5 text-left text-sm hover:bg-primary/10 transition-colors border-b border-border/40 last:border-0"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{p.nombre}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-brand-cyan">
                  {formatBs(p.precio_venta_bs)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
