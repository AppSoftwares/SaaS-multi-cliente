import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

const ETIQUETA: Record<string, string> = {
  INGRESO: "Ingreso",
  VENTA: "Venta/Salida",
  AJUSTE: "Ajuste",
  ALTA: "Alta",
};

interface MovConProducto {
  id: string;
  tipo: string;
  cantidad_afectada: number;
  cantidad_resultante: number;
  created_at: string;
  producto_id: string;
  productos: { nombre: string } | null;
}

export default async function MovimientosPage() {
  const { DEMO, demoMovimientos, demoProductos } = await import("@/lib/demo");

  let movimientos: MovConProducto[];
  if (DEMO) {
    movimientos = demoMovimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      cantidad_afectada: m.cantidad_afectada,
      cantidad_resultante: m.cantidad_resultante,
      created_at: m.created_at,
      producto_id: m.producto_id,
      productos: { nombre: demoProductos.find((p) => p.id === m.producto_id)?.nombre ?? "Producto" },
    }));
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("movimientos_inventario")
      .select("id, tipo, cantidad_afectada, cantidad_resultante, created_at, producto_id, productos(nombre)")
      .order("created_at", { ascending: false })
      .limit(100);
    movimientos = (data ?? []) as unknown as MovConProducto[];
  }

  return (
    <div className="space-y-4 animate-in-up">
      <h1 className="text-2xl font-bold text-gradient">Historial de movimientos</h1>
      {movimientos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin movimientos aún.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y text-sm">
              {movimientos.map((m, i) => (
                <li
                  key={m.id}
                  className="stagger-item flex items-center justify-between gap-3 p-3"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <div className="min-w-0">
                    <Link href={`/productos/${m.producto_id}`} className="font-medium hover:underline truncate block">
                      {m.productos?.nombre ?? "Producto"}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {ETIQUETA[m.tipo] ?? m.tipo} · {formatFecha(m.created_at)}
                    </span>
                  </div>
                  <span
                    className={
                      m.cantidad_afectada >= 0
                        ? "text-emerald-600 shrink-0"
                        : "text-destructive shrink-0"
                    }
                  >
                    {m.cantidad_afectada >= 0 ? "+" : ""}
                    {m.cantidad_afectada}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
