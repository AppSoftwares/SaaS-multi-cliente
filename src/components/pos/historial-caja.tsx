"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatBs, formatFecha } from "@/lib/format";
import { DEMO, demoCierreCajaPorFecha } from "@/lib/demo";
import { Printer, Undo2 } from "lucide-react";
import type { CierreCaja, VentaDelDia } from "@/lib/types";

export function HistorialCaja({
  ventas: ventasIniciales,
  esAdmin,
  fecha,
  hoy,
}: {
  ventas: VentaDelDia[];
  esAdmin: boolean;
  fecha: string;
  hoy: string;
}) {
  const router = useRouter();
  const [ventas, setVentas] = useState(ventasIniciales);
  const [cerrando, setCerrando] = useState(false);
  const [cierre, setCierre] = useState<CierreCaja | null>(null);
  const [ventaAnular, setVentaAnular] = useState<VentaDelDia | null>(null);
  const [anulando, setAnulando] = useState(false);
  const esHoy = fecha === hoy;

  useEffect(() => {
    setVentas(ventasIniciales);
  }, [ventasIniciales]);

  function formatFechaCorta(f: string) {
    const [y, m, d] = f.split("-").map(Number);
    return new Intl.DateTimeFormat("es-VE", { dateStyle: "medium" }).format(new Date(y, m - 1, d));
  }

  function irAFecha(nuevaFecha: string) {
    setCierre(null);
    router.push(nuevaFecha === hoy ? "/pos/historial" : `/pos/historial?fecha=${nuevaFecha}`);
  }

  async function cerrarCaja() {
    setCerrando(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 400));
      setCerrando(false);
      setCierre(demoCierreCajaPorFecha(fecha));
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.rpc("cierre_caja", { p_fecha: fecha });
    setCerrando(false);
    if (error) return toast.error(error.message);
    setCierre(data as CierreCaja);
    router.refresh();
  }

  async function confirmarAnular() {
    if (!ventaAnular) return;
    setAnulando(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 300));
      setVentas((vs) => vs.map((v) => (v.id === ventaAnular.id ? { ...v, estado: "cancelado" } : v)));
      setAnulando(false);
      setVentaAnular(null);
      return toast.success("(Demo) Venta anulada");
    }
    const supabase = createClient();
    const { error } = await supabase.rpc("anular_venta_pos", { p_pedido_id: ventaAnular.id });
    setAnulando(false);
    if (error) return toast.error(error.message);
    setVentas((vs) => vs.map((v) => (v.id === ventaAnular.id ? { ...v, estado: "cancelado" } : v)));
    setVentaAnular(null);
    toast.success("Venta anulada, stock repuesto");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {esHoy ? `Ventas de hoy (${ventas.length})` : `Ventas del ${formatFechaCorta(fecha)} (${ventas.length})`}
            </CardTitle>
            {!esHoy && (
              <Button variant="outline" size="sm" onClick={() => irAFecha(hoy)}>
                Hoy
              </Button>
            )}
          </div>
          <Input type="date" value={fecha} max={hoy} onChange={(e) => e.target.value && irAFecha(e.target.value)} />
        </CardHeader>
        <CardContent className="p-0">
          {ventas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">
              {esHoy ? "Aún no hay ventas registradas hoy." : "No hay ventas registradas en esta fecha."}
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {ventas.map((v) => {
                const anulada = v.estado === "cancelado";
                return (
                  <li key={v.id} className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-2">
                        Venta #{v.numero_venta}
                        {v.cliente_nombre ? ` · ${v.cliente_nombre}` : ""}
                        {anulada && <Badge variant="destructive">Anulada</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatFecha(v.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold ${anulada ? "line-through text-muted-foreground" : "text-brand-cyan"}`}>
                        {formatBs(v.total_bs)}
                      </span>
                      {esAdmin && !anulada && (
                        <button
                          type="button"
                          aria-label="Anular venta"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setVentaAnular(v)}
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      )}
                      <Link href={`/pos/ticket/${v.id}`} aria-label="Ver ticket">
                        <Printer className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!ventaAnular} onOpenChange={(o) => !o && setVentaAnular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular venta</DialogTitle>
            <DialogDescription>
              {ventaAnular && `Venta #${ventaAnular.numero_venta} · ${formatBs(ventaAnular.total_bs)}. El stock vendido se repondrá. Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVentaAnular(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarAnular} disabled={anulando}>
              {anulando ? "Anulando…" : "Anular venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cierre ? (
        <Card className="!border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Cierre de caja — {cierre.fecha}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(cierre.por_metodo).map(([metodo, monto]) => (
              <div key={metodo} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{metodo}</span>
                <span className="font-medium">{formatBs(monto)}</span>
              </div>
            ))}
            <div className="border-t border-border/50 pt-2 flex items-center justify-between font-bold">
              <span>Total ({cierre.ventas} ventas)</span>
              <span className="text-gradient">{formatBs(cierre.total_bs)}</span>
            </div>
            {cierre.pendiente_por_cobrar_bs > 0 && (
              <div className="flex items-center justify-between text-sm text-amber-600">
                <span>Créditos pendientes por cobrar</span>
                <span className="font-medium">{formatBs(cierre.pendiente_por_cobrar_bs)}</span>
              </div>
            )}
            <Button onClick={() => router.push("/pos/historial/imprimir")} className="w-full">
              <Printer className="h-4 w-4" /> Ver / imprimir comprobante
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={cerrarCaja} disabled={cerrando || ventas.length === 0} className="w-full h-12">
          {cerrando ? "Calculando…" : "Cerrar caja"}
        </Button>
      )}
    </div>
  );
}
