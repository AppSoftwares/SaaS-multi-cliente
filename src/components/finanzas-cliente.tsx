"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO, demoFinanzas, DEMO_BINANCE } from "@/lib/demo";
import { formatBs, formatUSD } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, FileWarning, Search, Wallet, BarChart3, Package, Truck, DollarSign, Scale } from "lucide-react";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  // Tasa Binance vigente: solo para llevar Bs y $ a una misma unidad en el
  // gráfico comparativo (la misma tasa que fija los precios en Bs).
  const [tasaBinance, setTasaBinance] = useState<number | null>(DEMO ? DEMO_BINANCE : null);

  useEffect(() => {
    if (DEMO) return;
    supabase
      .from("negocios")
      .select("tasa_binance")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setTasaBinance(data?.tasa_binance ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resumen entró / salió / debo del período. "Entró" es lo efectivamente
  // cobrado: las ventas a crédito no se cuentan hasta que se cobren.
  const resumen = useMemo(() => {
    if (!datos) return null;
    let cobradoUsd = 0;
    let cobradoBs = 0;
    let creditoBs = 0;
    for (const v of datos.ventas_por_metodo) {
      if (v.metodo === "Crédito") {
        creditoBs += v.monto_bs;
      } else if (v.moneda === "USD") {
        cobradoUsd += v.monto_moneda;
      } else {
        cobradoBs += v.monto_moneda;
      }
    }
    const aUsd = (usd: number, bs: number) => (tasaBinance && tasaBinance > 0 ? usd + bs / tasaBinance : null);
    const entro = aUsd(cobradoUsd, cobradoBs);
    const salio = aUsd(datos.pagos_proveedor_usd, datos.pagos_proveedor_bs);
    const debo = aUsd(datos.facturas_pendientes_usd, datos.facturas_pendientes_bs);
    return {
      cobradoUsd,
      cobradoBs,
      creditoBs,
      entro,
      salio,
      debo,
      balance: entro !== null && salio !== null ? entro - salio : null,
    };
  }, [datos, tasaBinance]);

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

          {resumen && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-brand-cyan" /> Resumen del período
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Entró por ventas
                    </p>
                    <span className="text-xs text-muted-foreground">{datos.ventas_cantidad} ventas</span>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">{formatBs(datos.ventas_bs)}</p>
                  <p className="text-xs text-muted-foreground">
                    Cobrado: {formatUSD(resumen.cobradoUsd)} en divisas · {formatBs(resumen.cobradoBs)} en bolívares
                  </p>
                  {resumen.creditoBs > 0 && (
                    <p className="text-xs text-amber-600">
                      Incluye {formatBs(resumen.creditoBs)} vendidos a crédito (aún por cobrar)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingDown className="h-3.5 w-3.5 text-amber-500" /> Salió (proveedores)
                    </p>
                    <p className="font-bold">{formatUSD(datos.pagos_proveedor_usd)}</p>
                    <p className="text-xs text-muted-foreground">{formatBs(datos.pagos_proveedor_bs)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileWarning className="h-3.5 w-3.5 text-red-500" /> Debo
                    </p>
                    <p className="font-bold">{formatUSD(datos.facturas_pendientes_usd)}</p>
                    <p className="text-xs text-muted-foreground">{formatBs(datos.facturas_pendientes_bs)}</p>
                  </div>
                </div>

                {resumen.entro !== null && resumen.salio !== null && resumen.debo !== null && resumen.balance !== null ? (
                  <>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { nombre: "Entró", usd: Math.round(resumen.entro * 100) / 100, color: "#059669" },
                            { nombre: "Pagado a proveedores", usd: Math.round(resumen.salio * 100) / 100, color: "#f59e0b" },
                            { nombre: "Por pagar", usd: Math.round(resumen.debo * 100) / 100, color: "#ef4444" },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                          <XAxis
                            dataKey="nombre"
                            fontSize={11}
                            tickLine={false}
                            tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
                          />
                          <YAxis fontSize={11} tickLine={false} width={44} />
                          <Tooltip formatter={(v) => [formatUSD(Number(v)), "Equivalente"]} />
                          <Bar dataKey="usd" radius={[4, 4, 0, 0]}>
                            {["#059669", "#f59e0b", "#ef4444"].map((c) => (
                              <Cell key={c} fill={c} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div
                      className={`rounded-lg border p-3 ${
                        resumen.balance >= 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"
                      }`}
                    >
                      <p className="text-xs text-muted-foreground">Balance del período (entró − pagado a proveedores)</p>
                      <p className={`text-xl font-bold ${resumen.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatUSD(resumen.balance)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Comparación en dólares equivalentes a tasa Binance {tasaBinance?.toLocaleString("es-VE")}. Es flujo de
                        caja: no descuenta el costo de la mercancía vendida ni lo que aún se debe.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Configura la tasa Binance para ver el gráfico comparativo y el balance del período.
                  </p>
                )}
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
