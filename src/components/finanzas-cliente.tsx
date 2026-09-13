"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO, demoFinanzas } from "@/lib/demo";
import { formatBs, formatUSD } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, FileWarning, Search, Wallet, BarChart3, Package, Truck, DollarSign } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinanzasPeriodo } from "@/lib/types";

function formatFechaCorta(f: string) {
  const [y, m, d] = f.split("-").map(Number);
  return new Intl.DateTimeFormat("es-VE", { day: "2-digit", month: "2-digit" }).format(new Date(y, m - 1, d));
}

function primerDiaDelMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function FinanzasCliente() {
  const supabase = createClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(hoy);
  const [datos, setDatos] = useState<FinanzasPeriodo | null>(null);
  const [cargando, setCargando] = useState(false);
  const [metodoSeleccionado, setMetodoSeleccionado] = useState<string | null>(null);

  async function consultar() {
    setCargando(true);
    setMetodoSeleccionado(null);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 300));
      setDatos({ ...demoFinanzas, desde, hasta });
      setCargando(false);
      return;
    }
    const { data, error } = await supabase.rpc("finanzas_periodo", { p_desde: desde, p_hasta: hasta });
    setCargando(false);
    if (error) return toast.error(error.message);
    const res = data as FinanzasPeriodo & { error?: string };
    if (res?.error) return toast.error(res.error);
    setDatos(res);
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rango de fecha</CardTitle>
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
          <Button onClick={consultar} disabled={cargando} className="w-full">
            <Search className="mr-2 h-4 w-4" /> {cargando ? "Consultando…" : "Consultar"}
          </Button>
        </CardContent>
      </Card>

      {datos && (
        <>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-white glow-purple">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Ventas del período</p>
                  <p className="font-bold">{formatBs(datos.ventas_bs)}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{datos.ventas_cantidad} ventas</span>
            </CardContent>
          </Card>

          {(datos.ventas_usd_recibido > 0 || datos.ventas_bs_recibido > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-brand-green" /> Recibido por moneda
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">En divisas ($)</p>
                  <p className="font-bold">{formatUSD(datos.ventas_usd_recibido)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">En bolívares</p>
                  <p className="font-bold">{formatBs(datos.ventas_bs_recibido)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {datos.ventas_por_metodo.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-brand-purple" /> Ventas por método de pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {[...datos.ventas_por_metodo]
                  .sort((a, b) => b.monto_bs - a.monto_bs)
                  .map((v) => {
                    const key = `${v.metodo}-${v.moneda}`;
                    const pct = datos.ventas_bs > 0 ? (v.monto_bs / datos.ventas_bs) * 100 : 0;
                    const activo = metodoSeleccionado === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMetodoSeleccionado(activo ? null : key)}
                        className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                          activo ? "border-brand-purple bg-brand-purple/10" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {v.metodo} {v.moneda === "USD" && <span className="text-xs text-muted-foreground">(divisas)</span>}
                          </span>
                          <span className="font-bold">
                            {v.moneda === "USD" ? formatUSD(v.monto_moneda) : formatBs(v.monto_moneda)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full gradient-primary"
                            style={{ width: `${pct.toFixed(1)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {pct.toFixed(1)}% del período{v.moneda === "USD" && ` · ≈ ${formatBs(v.monto_bs)}`}
                        </p>
                      </button>
                    );
                  })}
              </CardContent>
            </Card>
          )}

          {datos.ventas_por_dia.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-brand-cyan" /> Ventas por día
                </CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.ventas_por_dia}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                    <XAxis dataKey="fecha" tickFormatter={formatFechaCorta} fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} width={40} />
                    <Tooltip
                      labelFormatter={(f) => formatFechaCorta(String(f))}
                      formatter={(v) => [formatBs(Number(v)), "Ventas"]}
                    />
                    <Bar dataKey="total_bs" fill="var(--brand-cyan)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {datos.top_productos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-brand-purple" /> Productos más vendidos
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.top_productos} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/50" />
                    <XAxis type="number" fontSize={11} tickLine={false} />
                    <YAxis
                      dataKey="nombre"
                      type="category"
                      width={90}
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 14)}…` : v)}
                    />
                    <Tooltip formatter={(v) => [Number(v), "Unidades"]} />
                    <Bar dataKey="cantidad" fill="var(--brand-purple)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {datos.pagos_por_proveedor.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-brand-amber" /> Pagos a proveedores del período
                </CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.pagos_por_proveedor}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                    <XAxis
                      dataKey="proveedor"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 10)}…` : v)}
                    />
                    <YAxis fontSize={11} tickLine={false} width={40} />
                    <Tooltip formatter={(v) => [formatBs(Number(v)), "Pagado"]} />
                    <Bar dataKey="monto_bs" fill="var(--brand-amber)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-brand-cyan" /> Pagos a proveedores
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">En USD</p>
                <p className="font-bold">{formatUSD(datos.pagos_proveedor_usd)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">En Bs</p>
                <p className="font-bold">{formatBs(datos.pagos_proveedor_bs)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className={datos.facturas_pendientes_cantidad > 0 ? "!border-amber-500/50" : undefined}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-amber-500" /> Facturas de proveedor pendientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {datos.facturas_pendientes_cantidad} factura(s) sin pagar (a la fecha de hoy)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">En USD</p>
                  <p className="font-bold">{formatUSD(datos.facturas_pendientes_usd)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">En Bs</p>
                  <p className="font-bold">{formatBs(datos.facturas_pendientes_bs)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
