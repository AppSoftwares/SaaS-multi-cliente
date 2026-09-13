"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { FileText, Image as ImageIcon, Printer, Receipt, Truck, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatFecha } from "@/lib/format";
import { linkWhatsApp } from "@/lib/whatsapp";
import type { Factura, PagoProveedor, Proveedor } from "@/lib/types";

const FORMAS_PAGO = ["Efectivo", "Pago Móvil", "Transferencia", "Zelle", "Binance (USDT)", "Otro"];

export function FacturasLista({
  inicial,
  proveedores,
  esAdmin,
  pagosIniciales,
  negocioId,
}: {
  inicial: (Factura & { proveedor_nombre?: string | null })[];
  proveedores: Proveedor[];
  esAdmin: boolean;
  pagosIniciales: PagoProveedor[];
  negocioId: string;
}) {
  const supabase = createClient();
  const [facturas, setFacturas] = useState(inicial);
  const [pagos, setPagos] = useState(pagosIniciales);
  const [facturaAbono, setFacturaAbono] = useState<Factura | null>(null);
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"BS" | "USD">("USD");
  const [formaPago, setFormaPago] = useState(FORMAS_PAGO[0]);
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [reciboImprimir, setReciboImprimir] = useState<{ factura: Factura; pago: PagoProveedor } | null>(null);
  const [facturaCompartir, setFacturaCompartir] = useState<Factura | null>(null);

  const nombreProveedor = (id: string | null) => proveedores.find((p) => p.id === id)?.nombre ?? null;
  const telefonoProveedor = (id: string | null) => proveedores.find((p) => p.id === id)?.telefono ?? null;

  function urlEntrega(f: Factura) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/entrega/${f.token_entrega}`;
  }

  function copiarEnlaceEntrega(f: Factura) {
    navigator.clipboard.writeText(urlEntrega(f));
    toast.success("Enlace copiado");
  }

  function saldoPendiente(f: Factura) {
    const pagado = pagos
      .filter((p) => p.factura_id === f.id && p.moneda === f.moneda)
      .reduce((s, p) => s + p.monto, 0);
    return Math.max(0, Math.round((f.monto_total - pagado) * 100) / 100);
  }

  function pagosDeFactura(id: string) {
    return pagos.filter((p) => p.factura_id === id).sort((a, b) => b.numero_recibo - a.numero_recibo);
  }

  async function togglePagada(f: Factura) {
    if (DEMO) {
      setFacturas((fs) => fs.map((x) => (x.id === f.id ? { ...x, pagada: !x.pagada } : x)));
      return toast.success("(Demo) Estado actualizado");
    }
    const { error } = await supabase.from("facturas").update({ pagada: !f.pagada }).eq("id", f.id);
    if (error) return toast.error(error.message);
    setFacturas((fs) => fs.map((x) => (x.id === f.id ? { ...x, pagada: !x.pagada } : x)));
  }

  function abrirAbono(f: Factura) {
    setFacturaAbono(f);
    setMonto("");
    setMoneda(f.moneda);
    setFormaPago(FORMAS_PAGO[0]);
    setReferencia("");
    setNotas("");
  }

  async function registrarAbono() {
    if (!facturaAbono) return;
    const m = Number(monto);
    if (!m || m <= 0) return toast.error("Ingresa un monto válido");

    setGuardando(true);

    if (DEMO) {
      const nuevoPago: PagoProveedor = {
        id: crypto.randomUUID(),
        negocio_id: negocioId,
        factura_id: facturaAbono.id,
        numero_recibo: pagos.length + 1,
        monto: m,
        moneda,
        forma_pago: formaPago,
        referencia: referencia || null,
        notas: notas || null,
        usuario_id: null,
        created_at: new Date().toISOString(),
      };
      setPagos((ps) => [nuevoPago, ...ps]);
      const nuevoSaldo = Math.max(0, Math.round((facturaAbono.monto_total - m) * 100) / 100);
      let facturaActualizada = facturaAbono;
      if (moneda === facturaAbono.moneda && nuevoSaldo <= 0) {
        setFacturas((fs) => fs.map((x) => (x.id === facturaAbono.id ? { ...x, pagada: true } : x)));
        facturaActualizada = { ...facturaAbono, pagada: true };
      }
      setGuardando(false);
      setFacturaAbono(null);
      setReciboImprimir({ factura: facturaActualizada, pago: nuevoPago });
      return toast.success("(Demo) Abono registrado");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("pagos_proveedor")
      .insert({
        negocio_id: negocioId,
        factura_id: facturaAbono.id,
        monto: m,
        moneda,
        forma_pago: formaPago,
        referencia: referencia || null,
        notas: notas || null,
        usuario_id: user?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      setGuardando(false);
      return toast.error(error.message);
    }

    const nuevoPago = data as PagoProveedor;
    setPagos((ps) => [nuevoPago, ...ps]);

    const saldoRestante =
      moneda === facturaAbono.moneda
        ? Math.max(
            0,
            Math.round(
              (facturaAbono.monto_total -
                pagos
                  .filter((p) => p.factura_id === facturaAbono.id && p.moneda === facturaAbono.moneda)
                  .reduce((s, p) => s + p.monto, 0) -
                m) *
                100
            ) / 100
          )
        : null;

    let facturaActualizada = facturaAbono;
    if (saldoRestante !== null && saldoRestante <= 0 && !facturaAbono.pagada) {
      const { error: errPagada } = await supabase.from("facturas").update({ pagada: true }).eq("id", facturaAbono.id);
      if (!errPagada) {
        setFacturas((fs) => fs.map((x) => (x.id === facturaAbono.id ? { ...x, pagada: true } : x)));
        facturaActualizada = { ...facturaAbono, pagada: true };
      }
    }

    setGuardando(false);
    setFacturaAbono(null);
    setReciboImprimir({ factura: facturaActualizada, pago: nuevoPago });
    toast.success("Abono registrado");
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facturas registradas ({facturas.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {facturas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Aún no hay facturas registradas.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {facturas.map((f, i) => {
                const saldo = saldoPendiente(f);
                const abonosF = pagosDeFactura(f.id);
                return (
                  <li key={f.id} className="stagger-item p-3 space-y-2" style={{ "--i": i } as React.CSSProperties}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0 gradient-primary text-white glow-purple">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {f.numero_factura || "Sin número"} — {f.proveedor_nombre ?? nombreProveedor(f.proveedor_id) ?? "Sin proveedor"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {f.fecha ?? new Date(f.created_at).toLocaleDateString()} · {f.monto_total.toFixed(2)} {f.moneda}
                            {!f.pagada && saldo > 0 && saldo < f.monto_total && (
                              <> · saldo {saldo.toFixed(2)} {f.moneda}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={f.estado === "aplicada" ? "default" : "secondary"}>
                          {f.estado === "aplicada" ? "Aplicada a stock" : "En revisión"}
                        </Badge>
                        <Badge
                          variant={f.pagada ? "default" : "outline"}
                          className={esAdmin ? "cursor-pointer" : ""}
                          onClick={esAdmin ? () => togglePagada(f) : undefined}
                        >
                          {f.pagada ? "Pagada" : "Pendiente"}
                        </Badge>
                        {f.imagen_url && (
                          <a
                            href={f.imagen_url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Ver factura"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {esAdmin && (
                      <div className="flex items-center gap-2">
                        {!f.pagada && (
                          <Button variant="outline" size="sm" className="h-8" onClick={() => abrirAbono(f)}>
                            <Receipt className="h-3.5 w-3.5 mr-1" /> Registrar abono
                          </Button>
                        )}
                        {!f.entregado && (
                          <Button variant="outline" size="sm" className="h-8" onClick={() => setFacturaCompartir(f)}>
                            <Truck className="h-3.5 w-3.5 mr-1" /> Repartidor
                          </Button>
                        )}
                        {f.entregado && (
                          <Badge variant="default">Entregado</Badge>
                        )}
                      </div>
                    )}

                    {abonosF.length > 0 && (
                      <ul className="pl-10 space-y-1">
                        {abonosF.map((p) => (
                          <li key={p.id} className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              Recibo #{p.numero_recibo} · {p.forma_pago}
                              {p.referencia && ` (Ref. ${p.referencia})`} · {formatFecha(p.created_at)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {p.monto.toFixed(2)} {p.moneda}
                              </span>
                              <button
                                type="button"
                                aria-label="Imprimir recibo"
                                className="hover:text-foreground"
                                onClick={() => setReciboImprimir({ factura: f, pago: p })}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!facturaAbono} onOpenChange={(o) => !o && setFacturaAbono(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
            <DialogDescription>
              {facturaAbono &&
                `Factura ${facturaAbono.numero_factura || "sin número"} · saldo ${saldoPendiente(facturaAbono).toFixed(2)} ${facturaAbono.moneda}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select value={moneda} onValueChange={(v) => v && setMoneda(v as "BS" | "USD")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="BS">BS</SelectItem>
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
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="N° de confirmación del pago móvil o transferencia"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Notas (opcional)</Label>
              <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFacturaAbono(null)}>
              Cancelar
            </Button>
            <Button onClick={registrarAbono} disabled={guardando}>
              {guardando ? "Guardando…" : "Registrar abono"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reciboImprimir && (
        <Dialog open onOpenChange={(o) => !o && setReciboImprimir(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recibo de pago</DialogTitle>
            </DialogHeader>
            <div
              id="ticket-imprimible"
              className="glass rounded-2xl p-4 font-mono text-sm space-y-2 max-w-xs mx-auto"
            >
              <p className="text-center font-bold">Recibo #{reciboImprimir.pago.numero_recibo}</p>
              <p className="text-center text-xs text-muted-foreground">
                {formatFecha(reciboImprimir.pago.created_at)}
              </p>
              <div className="border-t border-dashed border-border pt-2 space-y-1 text-xs">
                <p>
                  Proveedor:{" "}
                  {reciboImprimir.factura.proveedor_id ? nombreProveedor(reciboImprimir.factura.proveedor_id) ?? "—" : "—"}
                </p>
                <p>Factura: {reciboImprimir.factura.numero_factura || "Sin número"}</p>
                <p>Forma de pago: {reciboImprimir.pago.forma_pago}</p>
                {reciboImprimir.pago.referencia && <p>Referencia: {reciboImprimir.pago.referencia}</p>}
                {reciboImprimir.pago.notas && <p>Notas: {reciboImprimir.pago.notas}</p>}
              </div>
              <div className="border-t border-dashed border-border pt-2 flex justify-between font-bold">
                <span>Monto abonado</span>
                <span>
                  {reciboImprimir.pago.monto.toFixed(2)} {reciboImprimir.pago.moneda}
                </span>
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

      <Dialog open={!!facturaCompartir} onOpenChange={(o) => !o && setFacturaCompartir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir con el repartidor</DialogTitle>
            <DialogDescription>
              {facturaCompartir &&
                `Factura ${facturaCompartir.numero_factura || "sin número"}. El repartidor podrá confirmar la recepción y el stock se actualizará solo.`}
            </DialogDescription>
          </DialogHeader>
          {facturaCompartir && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-border/40 p-2">
                <p className="flex-1 truncate text-xs text-muted-foreground">{urlEntrega(facturaCompartir)}</p>
                <button type="button" onClick={() => copiarEnlaceEntrega(facturaCompartir)} aria-label="Copiar enlace">
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <a
                href={linkWhatsApp(
                  `Hola, aquí está el enlace para confirmar la entrega de la factura ${facturaCompartir.numero_factura || ""}: ${urlEntrega(facturaCompartir)}`,
                  telefonoProveedor(facturaCompartir.proveedor_id)
                )}
                target="_blank"
                rel="noreferrer"
              >
                <Button className="w-full">Enviar por WhatsApp</Button>
              </a>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFacturaCompartir(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
