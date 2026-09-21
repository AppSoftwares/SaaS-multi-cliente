"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO, demoProductos } from "@/lib/demo";
import { Input } from "@/components/ui/input";
import { Search, Package } from "lucide-react";
import { filtrosBusqueda, coincidePalabras } from "@/lib/utils";
import { formatBs, formatUSD } from "@/lib/format";
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
            .filter((p) => coincidePalabras(`${p.nombre} ${p.sku ?? ""} ${p.codigo_barras ?? ""}`, q))
            .slice(0, 40)
        );
      } else {
        const supabase = createClient();
        let query = supabase
          .from("productos")
          .select(
            "id, nombre, codigo_barras, unidad_medida, cantidad, stock_minimo, precio_venta, precio_venta_bs, precio_venta_usd_ajustado, activo"
          )
          .eq("activo", true);
        for (const f of filtrosBusqueda(t)) query = query.or(f);
        const { data } = await query.order("nombre").limit(40);
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
        // En flujo normal (no absoluta): una lista que sobresale de la pantalla no
        // agrega altura a la página y sus últimos resultados quedaban inalcanzables.
        <div className="mt-1 w-full glass rounded-xl max-h-[50vh] overflow-y-auto overscroll-contain touch-pan-y">
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
                <span className="shrink-0 text-right leading-tight">
                  <span className="block text-xs font-semibold text-brand-cyan">{formatBs(p.precio_venta_bs)}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatUSD(p.precio_venta)} · BCV {formatUSD(p.precio_venta_usd_ajustado)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
