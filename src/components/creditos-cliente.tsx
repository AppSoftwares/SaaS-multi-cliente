"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO, demoDetalleCredito } from "@/lib/demo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreditCard, Receipt, Printer } from "lucide-react";
import { formatBs, formatFecha } from "@/lib/format";
import type { CobroCredito, DetalleCreditoCliente, SaldoCreditoCliente } from "@/lib/types";

const FORMAS_PAGO = ["Efectivo", "Pago Móvil", "Transferencia", "Zelle", "Binance (USDT)", "Otro"];

export function CreditosCliente({ inicial }: { inicial: SaldoCreditoCliente[] }) {
  const supabase = createClient();
  const [saldos, setSaldos] = useState(inicial);
  const [clienteSel, setClienteSel] = useState<SaldoCreditoCliente | null>(null);
  const [detalle, setDetalle] = useState<DetalleCreditoCliente | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"BS" | "USD">("BS");
  const [formaPago, setFormaPago] = useState(FORMAS_PAGO[0]);
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [reciboImprimir, setReciboImprimir] = useState<CobroCredito | null>(null);

  async function abrirDetalle(c: SaldoCreditoCliente) {
    setClienteSel(c);
    setMonto("");
    setMoneda("BS");
    setFormaPago(FORMAS_PAGO[0]);
    setReferencia("");
    setNotas("");
    setCargandoDetalle(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 200));
      setDetalle(demoDetalleCredito(c.cliente_cedula));
      setCargandoDetalle(false);
      return;
    }
    const { data, error } = await supabase.rpc("detalle_credito_cliente", { p_cedula: c.cliente_cedula });
    setCargandoDetalle(false);
    if (error) return toast.error(error.message);
    setDetalle(data as DetalleCreditoCliente);
  }

  function cerrarDetalle() {
    setClienteSel(null);
    setDetalle(null);
  }

  async function registrarAbono() {
    if (!clienteSel || !detalle) return;
    const m = Number(monto);
    if (!m || m <= 0) return toast.error("Ingresa un monto válido");

    setGuardando(true);

    if (DEMO) {
      const nuevoAbono: CobroCredito = {
        id: crypto.randomUUID(),
        negocio_id: "demo-negocio",
        cliente_cedula: clienteSel.cliente_cedula,
        numero_recibo: detalle.abonos.length + 1,
        monto: m,
        moneda,
        monto_bs: m,
        forma_pago: formaPago,
        referencia: referencia || null,
        notas: notas || null,
        usuario_id: null,
        created_at: new Date().toISOString(),
      };
      const nuevoSaldo = Math.max(0, Math.round((detalle.saldo_bs - m) * 100) / 100);
      setDetalle({ ...detalle, saldo_bs: nuevoSaldo, abonos: [nuevoAbono, ...detalle.abonos] });
      setSaldos((ss) =>
        ss
          .map((s) => (s.cliente_cedula === clienteSel.cliente_cedula ? { ...s, saldo_bs: nuevoSaldo, total_abonado_bs: s.total_abonado_bs + m } : s))
          .filter((s) => s.saldo_bs > 0.01)
      );
      setMonto("");
      setGuardando(false);
      setReciboImprimir(nuevoAbono);
      return toast.success("(Demo) Abono registrado");
    }

    const { data, error } = await supabase.rpc("registrar_cobro_credito", {
      p_cliente_cedula: clienteSel.cliente_cedula,
      p_monto: m,
      p_moneda: moneda,
      p_forma_pago: formaPago,
      p_referencia: referencia || null,
      p_notas: notas || null,
    });
    setGuardando(false);
    if (error) return toast.error(error.message);

    const res = data as { id: string; numero_recibo: number; monto_bs: number };
    const nuevoAbono: CobroCredito = {
      id: res.id,
      negocio_id: "",
      cliente_cedula: clienteSel.cliente_cedula,
      numero_recibo: res.numero_recibo,
      monto: m,
      moneda,
      monto_bs: res.monto_bs,
      forma_pago: formaPago,
      referencia: referencia || null,
      notas: notas || null,
      usuario_id: null,
      created_at: new Date().toISOString(),
    };
    const nuevoSaldo = Math.max(0, Math.round((detalle.saldo_bs - res.monto_bs) * 100) / 100);
    setDetalle({ ...detalle, saldo_bs: nuevoSaldo, abonos: [nuevoAbono, ...detalle.abonos] });
    setSaldos((ss) =>
      ss
        .map((s) =>
          s.cliente_cedula === clienteSel.cliente_cedula
            ? { ...s, saldo_bs: nuevoSaldo, total_abonado_bs: s.total_abonado_bs + res.monto_bs }
            : s
        )
        .filter((s) => s.saldo_bs > 0.01)
    );
    setMonto("");
    setReferencia("");
    setNotas("");
    setReciboImprimir(nuevoAbono);
    toast.success("Abono registrado");
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes con saldo pendiente ({saldos.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {saldos.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No hay créditos pendientes por cobrar.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {saldos.map((s, i) => (
                <li
                  key={s.cliente_cedula}
                  className="stagger-item flex items-center justify-between gap-2 p-3 cursor-pointer hover:bg-muted/40"
                  style={{ "--i": i } as React.CSSProperties}
                  onClick={() => abrirDetalle(s)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0 gradient-primary text-white glow-purple">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {[s.cliente_nombre, s.cliente_apellido].filter(Boolean).join(" ") || "Sin nombre"} · {s.cliente_cedula}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Última venta a crédito {formatFecha(s.ultima_venta_at)}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-brand-cyan shrink-0">{formatBs(s.saldo_bs)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!clienteSel} onOpenChange={(o) => !o && cerrarDetalle()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {clienteSel && ([clienteSel.cliente_nombre, clienteSel.cliente_apellido].filter(Boolean).join(" ") || clienteSel.cliente_cedula)}
            </DialogTitle>
            <DialogDescription>
              {clienteSel && `Cédula ${clienteSel.cliente_cedula}${clienteSel.cliente_telefono ? ` · ${clienteSel.cliente_telefono}` : ""}`}
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle || !detalle ? (
            <p className="text-sm text-muted-foreground py-4">Cargando…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
                <span className="text-sm text-muted-foreground">Saldo pendiente</span>
                <span className="text-lg font-bold text-gradient">{formatBs(detalle.saldo_bs)}</span>
              </div>

              {detalle.ventas.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Ventas a crédito</Label>
                  <ul className="space-y-1">
                    {detalle.ventas.map((v) => (
                      <li key={v.pedido_id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Venta #{v.numero_venta} · {formatFecha(v.created_at)}</span>
                        <span className="font-medium">{formatBs(v.monto_bs)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detalle.abonos.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Abonos</Label>
                  <ul className="space-y-1">
                    {detalle.abonos.map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Recibo #{a.numero_recibo} · {a.forma_pago}
                          {a.referencia && ` (Ref. ${a.referencia})`} · {formatFecha(a.created_at)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{a.monto.toFixed(2)} {a.moneda}</span>
                          <button type="button" aria-label="Imprimir recibo" className="hover:text-foreground" onClick={() => setReciboImprimir(a)}>
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detalle.saldo_bs > 0 && (
                <div className="space-y-3 border-t border-border/40 pt-3">
                  <Label className="text-sm">Registrar abono</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Monto</Label>
                      <Input type="number" min={0} step="0.01" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
                    </div>
                    <div className="space-y-1">
                      <Label>Moneda</Label>
                      <Select value={moneda} onValueChange={(v) => v && setMoneda(v as "BS" | "USD")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BS">BS</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Forma de pago</Label>
                    <Select value={formaPago} onValueChange={(v) => v && setFormaPago(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGO.map((fp) => (
                          <SelectItem key={fp} value={fp}>
                            {fp}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(formaPago === "Pago Móvil" || formaPago === "Transferencia") && (
                    <div className="space-y-1">
                      <Label>N° de referencia</Label>
                      <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N° de confirmación" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Notas (opcional)</Label>
                    <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
                  </div>
                  <Button onClick={registrarAbono} disabled={guardando} className="w-full">
                    <Receipt className="h-4 w-4 mr-1" /> {guardando ? "Guardando…" : "Registrar abono"}
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={cerrarDetalle}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reciboImprimir && (
        <Dialog open onOpenChange={(o) => !o && setReciboImprimir(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recibo de abono</DialogTitle>
            </DialogHeader>
            <div id="ticket-imprimible" className="glass rounded-2xl p-4 font-mono text-sm space-y-2 max-w-xs mx-auto">
              <p className="text-center font-bold">Recibo #{reciboImprimir.numero_recibo}</p>
              <p className="text-center text-xs text-muted-foreground">{formatFecha(reciboImprimir.created_at)}</p>
              <div className="border-t border-dashed border-border pt-2 space-y-1 text-xs">
                <p>Cliente: {reciboImprimir.cliente_cedula}</p>
                <p>Forma de pago: {reciboImprimir.forma_pago}</p>
                {reciboImprimir.referencia && <p>Referencia: {reciboImprimir.referencia}</p>}
                {reciboImprimir.notas && <p>Notas: {reciboImprimir.notas}</p>}
              </div>
              <div className="border-t border-dashed border-border pt-2 flex justify-between font-bold">
                <span>Monto abonado</span>
                <span>{reciboImprimir.monto.toFixed(2)} {reciboImprimir.moneda}</span>
              </div>
            </div>
            <DialogFooter className="print:hidden">
              <Button variant="outline" onClick={() => setReciboImprimir(null)}>
                Cerrar
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
