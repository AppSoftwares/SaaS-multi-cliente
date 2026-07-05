"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { descargarXlsx } from "@/lib/reportes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download } from "lucide-react";
import type { Producto } from "@/lib/types";

export function ReportesCliente() {
  const supabase = createClient();
  const [proc, setProc] = useState<string | null>(null);
  const hoy = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);

  async function inventarioValorizado() {
    setProc("inv");
    // Productos + costo (RLS deja el costo solo a ADMIN)
    const { data: prods } = await supabase.from("productos").select("*").order("nombre");
    const { data: costos } = await supabase
      .from("productos_costos")
      .select("producto_id, precio_costo");
    setProc(null);

    const mapaCosto = new Map(
      (costos ?? []).map((c) => [c.producto_id as string, Number(c.precio_costo)])
    );
    const filas = ((prods ?? []) as Producto[]).map((p) => {
      const costo = mapaCosto.get(p.id) ?? 0;
      return {
        Nombre: p.nombre,
        Categoría: p.categoria ?? "",
        SKU: p.sku ?? "",
        "Código barras": p.codigo_barras ?? "",
        Cantidad: p.cantidad,
        Unidad: p.unidad_medida,
        "Stock mínimo": p.stock_minimo,
        "Precio venta": p.precio_venta,
        "Valor venta": +(p.cantidad * p.precio_venta).toFixed(2),
        "Precio costo": costo,
        "Valor costo": +(p.cantidad * costo).toFixed(2),
        Margen: +(p.precio_venta - costo).toFixed(2),
        Proveedor: p.proveedor ?? "",
        Ubicación: p.ubicacion ?? "",
      };
    });
    if (filas.length === 0) return toast.error("No hay productos");
    descargarXlsx(filas, "Inventario", "inventario_valorizado");
  }

  async function bajoStock() {
    setProc("bajo");
    const { data } = await supabase
      .from("productos")
      .select("nombre, categoria, cantidad, stock_minimo, unidad_medida, proveedor")
      .gt("stock_minimo", 0)
      .order("cantidad");
    setProc(null);
    const filas = ((data ?? []) as Producto[])
      .filter((p) => p.cantidad <= p.stock_minimo)
      .map((p) => ({
        Nombre: p.nombre,
        Categoría: p.categoria ?? "",
        Existencia: p.cantidad,
        "Stock mínimo": p.stock_minimo,
        "A reponer": Math.max(0, p.stock_minimo - p.cantidad),
        Unidad: p.unidad_medida,
        Proveedor: p.proveedor ?? "",
      }));
    if (filas.length === 0) return toast.success("No hay productos bajo el mínimo");
    descargarXlsx(filas, "Reorden", "reposicion_stock");
  }

  async function movimientos() {
    setProc("mov");
    const hastaFin = `${hasta}T23:59:59`;
    const { data } = await supabase
      .from("movimientos_inventario")
      .select("tipo, cantidad_afectada, cantidad_resultante, nota, created_at, productos(nombre)")
      .gte("created_at", desde)
      .lte("created_at", hastaFin)
      .order("created_at", { ascending: false });
    setProc(null);
    const filas = ((data ?? []) as unknown as Array<{
      tipo: string;
      cantidad_afectada: number;
      cantidad_resultante: number;
      nota: string | null;
      created_at: string;
      productos: { nombre: string } | null;
    }>).map((m) => ({
      Fecha: new Date(m.created_at).toLocaleString("es-US"),
      Producto: m.productos?.nombre ?? "",
      Tipo: m.tipo,
      Cantidad: m.cantidad_afectada,
      Resultante: m.cantidad_resultante,
      Nota: m.nota ?? "",
    }));
    if (filas.length === 0) return toast.error("Sin movimientos en el rango");
    descargarXlsx(filas, "Movimientos", "movimientos");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventario</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button onClick={inventarioValorizado} disabled={proc === "inv"}>
            <Download className="mr-2 h-4 w-4" /> Inventario valorizado
          </Button>
          <Button variant="secondary" onClick={bajoStock} disabled={proc === "bajo"}>
            <Download className="mr-2 h-4 w-4" /> Reposición (bajo stock)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos por fecha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
          <Button onClick={movimientos} disabled={proc === "mov"} className="w-full">
            <Download className="mr-2 h-4 w-4" /> Exportar movimientos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
