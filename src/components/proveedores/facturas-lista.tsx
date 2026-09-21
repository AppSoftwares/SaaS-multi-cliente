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
import { FileText, Image as ImageIcon, Printer, Receipt, Truck, Copy, Archive, Tags, UserPen } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { imprimirEtiquetas } from "@/lib/etiquetas";
import { toast } from "sonner";
import { formatFecha } from "@/lib/format";
import { linkWhatsApp } from "@/lib/whatsapp";
import type { Factura, PagoProveedor, Proveedor } from "@/lib/types";

const FORMAS_PAGO = ["Efectivo", "Pago Móvil", "Transferencia", "Zelle", "Binance (USDT)", "Otro"];

type FacturaLista = Factura & { proveedor_nombre?: string | null };

interface ItemEtiqueta {
  producto_id: string;
  nombre: string;
  codigo: string;
  recibidas: number;
  copias: number;
}

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
  // A pedido del cliente: la lista principal solo muestra pendientes por
  // pagar; las pagadas se archivan aparte y se consultan con un clic.
  const [verPagadas, setVerPagadas] = useState(false);
  const [dialogPagada, setDialogPagada] = useState<{
    factura: FacturaLista;
    modo: "bloqueado" | "confirmar" | "reabrir";
  } | null>(null);

  // Etiquetas (código de barras) de los productos de una factura ya cargada.
  const [facturaEtiquetas, setFacturaEtiquetas] = useState<FacturaLista | null>(null);
  const [itemsEtiqueta, setItemsEtiqueta] = useState<ItemEtiqueta[] | null>(null);
  const [porUnidad, setPorUnidad] = useState(false);

  // Cambiar el proveedor de una factura ya registrada.
  const [facturaProveedor, setFacturaProveedor] = useState<FacturaLista | null>(null);
  const [nuevoProveedorId, setNuevoProveedorId] = useState("");
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);

  async function abrirEtiquetas(f: FacturaLista) {
    setFacturaEtiquetas(f);
    setItemsEtiqueta(null);
    setPorUnidad(false);
    if (DEMO) {
      setItemsEtiqueta([]);
      return;
    }
    const { data: lineas, error } = await supabase
      .from("factura_items")
      .select("producto_id, nombre, cantidad")
      .eq("factura_id", f.id)
      .not("producto_id", "is", null)
      .order("created_at");
    if (error) {
      setFacturaEtiquetas(null);
      return toast.error(error.message);
    }
    const ids = [...new Set((lineas ?? []).map((l) => l.producto_id as string))];
    const { data: prods } = ids.length
      ? await supabase.from("productos").select("id, nombre, codigo_barras").in("id", ids)
      : { data: [] as { id: string; nombre: string; codigo_barras: string | null }[] };
    const porId = new Map((prods ?? []).map((p) => [p.id, p]));
    const items: ItemEtiqueta[] = [];
    for (const l of lineas ?? []) {
      const p = porId.get(l.producto_id as string);
      if (!p?.codigo_barras) continue;
      items.push({
        producto_id: p.id,
        nombre: p.nombre,
        codigo: p.codigo_barras,
        recibidas: Math.max(1, Math.round(Number(l.cantidad) || 1)),
        copias: 1,
      });
    }
    setItemsEtiqueta(items);
  }

  function copiasDe(it: ItemEtiqueta) {
    return porUnidad ? it.recibidas : it.copias;
  }

  function imprimirTodasEtiquetas() {
    if (!itemsEtiqueta?.length) return;
    const ok = imprimirEtiquetas(itemsEtiqueta.map((it) => ({ nombre: it.nombre, codigo: it.codigo, copias: copiasDe(it) })));
    if (!ok) toast.error("No se pudo abrir la ventana de impresión (permite las ventanas emergentes del navegador)");
  }

  async function guardarProveedorFactura() {
    if (!facturaProveedor || !nuevoProveedorId) return;
    const prov = proveedores.find((p) => p.id === nuevoProveedorId);
    setGuardandoProveedor(true);
    if (!DEMO) {
      const { error } = await supabase
        .from("facturas")
        .update({ proveedor_id: nuevoProveedorId, proveedor_nombre_nuevo: null })
        .eq("id", facturaProveedor.id);
      if (error) {
        setGuardandoProveedor(false);
        return toast.error(error.message);
      }
    }
    setFacturas((fs) =>
      fs.map((x) =>
        x.id === facturaProveedor.id ? { ...x, proveedor_id: nuevoProveedorId, proveedor_nombre: prov?.nombre ?? null } : x
      )
    );
    setGuardandoProveedor(false);
    setFacturaProveedor(null);
    toast.success("Proveedor actualizado");
  }

  const facturasPendientes = facturas.filter((f) => !f.pagada);
  const facturasPagadas = facturas.filter((f) => f.pagada);
  const facturasVisibles = verPagadas ? facturasPagadas : facturasPendientes;

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

  // Un clic en la etiqueta Pendiente/Pagada ya no cambia el estado de golpe:
  // si falta saldo, avisa que hay que registrar abonos; si los abonos ya
  // cubren el total, pide confirmación (y también al reabrir una pagada).
  function pedirCambioPagada(f: FacturaLista) {
    if (f.pagada) return setDialogPagada({ factura: f, modo: "reabrir" });
    setDialogPagada({ factura: f, modo: saldoPendiente(f) > 0.005 ? "bloqueado" : "confirmar" });
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
          <CardTitle className="text-base flex items-center justify-between">
            <span>{verPagadas ? "Facturas pagadas" : "Pendientes por pagar"} ({facturasVisibles.length})</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setVerPagadas((v) => !v)}
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              {verPagadas ? "Ver pendientes" : `Ver pagadas (${facturasPagadas.length})`}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {facturasVisibles.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">
              {verPagadas ? "Aún no hay facturas pagadas." : "No hay facturas pendientes por pagar."}
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {facturasVisibles.map((f, i) => {
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
                          onClick={esAdmin ? () => pedirCambioPagada(f) : undefined}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8" onClick={() => abrirEtiquetas(f)}>
                          <Tags className="h-3.5 w-3.5 mr-1" /> Etiquetas
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setFacturaProveedor(f);
                            setNuevoProveedorId(f.proveedor_id ?? "");
                          }}
                        >
                          <UserPen className="h-3.5 w-3.5 mr-1" /> Proveedor
                        </Button>
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

      <Dialog open={!!dialogPagada} onOpenChange={(o) => !o && setDialogPagada(null)}>
        <DialogContent>
          {dialogPagada && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dialogPagada.modo === "bloqueado"
                    ? "Aún hay saldo por pagar"
                    : dialogPagada.modo === "confirmar"
                      ? "¿Marcar la factura como pagada?"
                      : "¿Volver a marcarla como pendiente?"}
                </DialogTitle>
                <DialogDescription>
                  Factura {dialogPagada.factura.numero_factura || "sin número"} ·{" "}
                  {dialogPagada.factura.proveedor_nombre ??
                    nombreProveedor(dialogPagada.factura.proveedor_id) ??
                    "Sin proveedor"}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {dialogPagada.modo === "bloqueado" &&
                  `Para marcarla como pagada primero hay que registrar los abonos. Total ${dialogPagada.factura.monto_total.toFixed(2)} ${dialogPagada.factura.moneda}, saldo pendiente ${saldoPendiente(dialogPagada.factura).toFixed(2)} ${dialogPagada.factura.moneda}. Al registrar un abono que cubra el saldo, se marca sola como pagada.`}
                {dialogPagada.modo === "confirmar" &&
                  "Los abonos registrados ya cubren el total de la factura. Al confirmar pasará al archivo de pagadas."}
                {dialogPagada.modo === "reabrir" &&
                  "La factura volverá a la lista de pendientes por pagar. Los abonos ya registrados no se borran."}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogPagada(null)}>
                  {dialogPagada.modo === "bloqueado" ? "Cerrar" : "Cancelar"}
                </Button>
                {dialogPagada.modo === "bloqueado" ? (
                  <Button
                    onClick={() => {
                      const f = dialogPagada.factura;
                      setDialogPagada(null);
                      abrirAbono(f);
                    }}
                  >
                    <Receipt className="h-4 w-4 mr-1" /> Registrar abono
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      const f = dialogPagada.factura;
                      setDialogPagada(null);
                      await togglePagada(f);
                    }}
                  >
                    {dialogPagada.modo === "confirmar" ? "Sí, marcar como pagada" : "Sí, volver a pendiente"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!facturaEtiquetas} onOpenChange={(o) => !o && setFacturaEtiquetas(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Etiquetas de la factura</DialogTitle>
            <DialogDescription>
              {facturaEtiquetas &&
                `Factura ${facturaEtiquetas.numero_factura || "sin número"} · código de barras de cada producto para pegar en la mercancía.`}
            </DialogDescription>
          </DialogHeader>
          {itemsEtiqueta === null ? (
            <p className="text-sm text-muted-foreground py-4">Cargando productos…</p>
          ) : itemsEtiqueta.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Esta factura no tiene productos con código de barras para etiquetar.
            </p>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={porUnidad} onCheckedChange={(v) => setPorUnidad(!!v)} />
                Una etiqueta por cada unidad recibida
              </label>
              <ul className="max-h-[45vh] overflow-y-auto divide-y divide-border/40 rounded-lg border border-border/40">
                {itemsEtiqueta.map((it, idx) => (
                  <li key={`${it.producto_id}-${idx}`} className="flex items-center justify-between gap-2 p-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{it.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {it.codigo} · recibidas: {it.recibidas}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      className="w-16 h-8 text-center shrink-0"
                      aria-label="Copias"
                      disabled={porUnidad}
                      value={copiasDe(it)}
                      onChange={(e) =>
                        setItemsEtiqueta((arr) =>
                          (arr ?? []).map((x, i) =>
                            i === idx ? { ...x, copias: Math.max(0, Number(e.target.value) || 0) } : x
                          )
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Total: {itemsEtiqueta.reduce((s, it) => s + copiasDe(it), 0)} etiquetas
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFacturaEtiquetas(null)}>
              Cerrar
            </Button>
            <Button onClick={imprimirTodasEtiquetas} disabled={!itemsEtiqueta?.length}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir etiquetas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!facturaProveedor} onOpenChange={(o) => !o && setFacturaProveedor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar proveedor</DialogTitle>
            <DialogDescription>
              {facturaProveedor && `Factura ${facturaProveedor.numero_factura || "sin número"}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Proveedor</Label>
            <Select value={nuevoProveedorId} onValueChange={(v) => v && setNuevoProveedorId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFacturaProveedor(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarProveedorFactura} disabled={guardandoProveedor || !nuevoProveedorId}>
              {guardandoProveedor ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
