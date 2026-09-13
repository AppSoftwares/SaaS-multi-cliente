"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DEMO, demoProductos, demoClientesPos, demoArqueo, metodosConReferencia } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, Plus, Minus, X, AlertTriangle, Percent, Lock, Printer } from "lucide-react";
import { formatBs, formatUSD, formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLectorPistola } from "@/hooks/usar-lector-pistola";
import { EscanerBarcode } from "@/components/captura/escaner-barcode";
import { BuscadorPos } from "@/components/pos/buscador-pos";
import { VistaTicket } from "@/components/pos/vista-ticket";
import { ModalDescuento } from "@/components/pos/modal-descuento";
import type {
  ArqueoTurno,
  ClientePos,
  ItemCarritoPos,
  MetodoPago,
  MonedaPago,
  ProductoPos,
  ResultadoVentaPos,
  TipoDescuento,
  TurnoCaja,
} from "@/lib/types";

interface LineaPago {
  metodo: string;
  moneda: MonedaPago;
  monto: string;
  referencia: string;
}

// Estado de la venta en curso que se conserva en localStorage para que no se
// pierda si el cajero navega a otra pestaña (Historial, Productos) y vuelve
// antes de completar el cobro.
interface VentaEnCurso {
  carrito: ItemCarritoPos[];
  pagos: LineaPago[];
  clienteTipoDoc: TipoDocumento;
  clienteNumeroDoc: string;
  clienteNombre: string;
  clienteApellido: string;
  clienteTelefono: string;
  clienteDireccion: string;
  descuentoGeneral: { tipo: TipoDescuento; valor: number } | null;
  aplicarIva: boolean;
  aplicarIgtf: boolean;
}

const VENTA_EN_CURSO_KEY = "pos_venta_en_curso";

function cargarVentaEnCurso(): VentaEnCurso | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(VENTA_EN_CURSO_KEY);
    return raw ? (JSON.parse(raw) as VentaEnCurso) : null;
  } catch {
    return null;
  }
}

type TipoDocumento = "V" | "E" | "J";

type ContextoDescuento =
  | { tipo: "item"; productoId: string; nombre: string }
  | { tipo: "general" }
  | null;

function calcularDescuentoLinea(bruto: number, tipo: TipoDescuento | null, valor: number): number {
  if (!tipo || !valor) return 0;
  if (tipo === "porcentaje") {
    return Math.round(((bruto * Math.min(Math.max(valor, 0), 100)) / 100) * 100) / 100;
  }
  return Math.min(Math.max(valor, 0), bruto);
}

export function PosCliente({
  metodosPago,
  negocioNombre,
  tasaBcv,
  tasaBinance,
  ivaTasa,
  igtfTasa,
  turnoInicial,
}: {
  metodosPago: MetodoPago[];
  negocioNombre: string;
  tasaBcv: number | null;
  tasaBinance: number | null;
  ivaTasa: number;
  igtfTasa: number;
  turnoInicial: TurnoCaja | null;
}) {
  const router = useRouter();
  const [turno, setTurno] = useState<TurnoCaja | null>(turnoInicial);
  const [montoApertura, setMontoApertura] = useState("");
  const [abriendoTurno, setAbriendoTurno] = useState(false);

  const [dialogCajaAbierto, setDialogCajaAbierto] = useState(false);
  const [arqueo, setArqueo] = useState<ArqueoTurno | null>(null);
  const [cargandoArqueo, setCargandoArqueo] = useState(false);
  const [montoCierre, setMontoCierre] = useState("");
  const [cerrandoTurno, setCerrandoTurno] = useState(false);

  const ventaGuardada = useState(() => cargarVentaEnCurso())[0];

  const [carrito, setCarrito] = useState<ItemCarritoPos[]>(() => ventaGuardada?.carrito ?? []);
  const [mostrarUsd, setMostrarUsd] = useState(false);
  const [escanerAbierto, setEscanerAbierto] = useState(false);

  const [clienteTipoDoc, setClienteTipoDoc] = useState<TipoDocumento>(() => ventaGuardada?.clienteTipoDoc ?? "V");
  const [clienteNumeroDoc, setClienteNumeroDoc] = useState(() => ventaGuardada?.clienteNumeroDoc ?? "");
  const [clienteNombre, setClienteNombre] = useState(() => ventaGuardada?.clienteNombre ?? "");
  const [clienteApellido, setClienteApellido] = useState(() => ventaGuardada?.clienteApellido ?? "");
  const [clienteTelefono, setClienteTelefono] = useState(() => ventaGuardada?.clienteTelefono ?? "");
  const [clienteDireccion, setClienteDireccion] = useState(() => ventaGuardada?.clienteDireccion ?? "");

  const [pagos, setPagos] = useState<LineaPago[]>(() => ventaGuardada?.pagos ?? []);
  const [cobrando, setCobrando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoVentaPos | null>(null);

  const [claveDescuentos, setClaveDescuentos] = useState<string | null>(null);
  const [descuentoGeneral, setDescuentoGeneral] = useState<{ tipo: TipoDescuento; valor: number } | null>(
    () => ventaGuardada?.descuentoGeneral ?? null
  );
  const [modalDescuento, setModalDescuento] = useState<ContextoDescuento>(null);

  const [aplicarIva, setAplicarIva] = useState(() => ventaGuardada?.aplicarIva ?? false);
  const [aplicarIgtf, setAplicarIgtf] = useState(() => ventaGuardada?.aplicarIgtf ?? false);

  // Guarda la venta en curso en sessionStorage para sobrevivir a la navegación
  // entre pestañas (Caja -> Historial/Productos -> Caja) sin perder el carrito.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (carrito.length === 0 && pagos.length === 0) {
      window.sessionStorage.removeItem(VENTA_EN_CURSO_KEY);
      return;
    }
    const datos: VentaEnCurso = {
      carrito,
      pagos,
      clienteTipoDoc,
      clienteNumeroDoc,
      clienteNombre,
      clienteApellido,
      clienteTelefono,
      clienteDireccion,
      descuentoGeneral,
      aplicarIva,
      aplicarIgtf,
    };
    window.sessionStorage.setItem(VENTA_EN_CURSO_KEY, JSON.stringify(datos));
  }, [carrito, pagos, clienteTipoDoc, clienteNumeroDoc, clienteNombre, clienteApellido, clienteTelefono, clienteDireccion, descuentoGeneral, aplicarIva, aplicarIgtf]);

  // --- Cálculo de totales (replica la lógica de crear_venta_pos) ---
  const itemsCalc = carrito.map((i) => {
    const bruto = i.cantidad * i.precio_venta_bs;
    const descMonto = calcularDescuentoLinea(bruto, i.descuento_tipo, i.descuento_valor);
    return { item: i, bruto, descMonto, neto: bruto - descMonto };
  });
  const subtotalBruto = itemsCalc.reduce((s, c) => s + c.bruto, 0);
  const descItems = itemsCalc.reduce((s, c) => s + c.descMonto, 0);
  const baseGeneral = subtotalBruto - descItems;
  const descGeneralBs = descuentoGeneral
    ? calcularDescuentoLinea(baseGeneral, descuentoGeneral.tipo, descuentoGeneral.valor)
    : 0;
  // Base imponible: la venta ya con descuentos, antes de impuestos.
  const totalBs = baseGeneral - descGeneralBs;
  const ivaBs = aplicarIva ? Math.round(totalBs * (ivaTasa / 100) * 100) / 100 : 0;
  // Total a cobrar (mercancía + IVA). El IGTF NO se suma aquí: es un cobro
  // adicional sobre el pago en divisas, no parte del precio de la venta.
  const totalConImpuestos = totalBs + ivaBs;

  const clienteCedula = clienteNumeroDoc.trim() ? `${clienteTipoDoc}-${clienteNumeroDoc.trim()}` : "";
  const requiereCliente = pagos.some((p) => p.metodo === "Crédito");

  // Referencia en divisas = precio_venta tal cual está cargado en el inventario
  // (uso interno del cajero, no se recalcula con tasa Binance/BCV).
  const totalUsdRef = carrito.reduce((s, i) => s + i.cantidad * i.precio_venta, 0);

  function montoALineaBs(p: LineaPago): number {
    const monto = Number(p.monto) || 0;
    if (p.moneda === "USD") {
      return tasaBcv && tasaBcv > 0 ? Math.round(monto * tasaBcv * 100) / 100 : 0;
    }
    return monto;
  }

  const pagosTotalBs = pagos.reduce((s, p) => s + montoALineaBs(p), 0);
  const diferencia = Math.round((totalConImpuestos - pagosTotalBs) * 100) / 100;
  // Al convertir un pago en USD a Bs, medio centavo de dólar (peor caso de
  // redondeo) ya son varios bolívares con la tasa BCV actual, así que la
  // tolerancia escala con la tasa (debe coincidir con crear_venta_pos).
  const toleranciaPagos = Math.max(0.5, (tasaBcv ?? 0) * 0.01);
  const pagosCuadran = Math.abs(diferencia) <= toleranciaPagos;

  // IGTF: cobro adicional sobre pagos en divisas, informativo (no afecta el
  // cuadre de pagos, se declara/reporta aparte). Solo aplica a moneda USD.
  function igtfDeLinea(p: LineaPago): number {
    if (!aplicarIgtf || p.moneda !== "USD") return 0;
    return Math.round(montoALineaBs(p) * (igtfTasa / 100) * 100) / 100;
  }
  const igtfTotalBs = pagos.reduce((s, p) => s + igtfDeLinea(p), 0);
  // Equivalencia de la diferencia en divisas, solo para que el cajero pueda
  // decirle al cliente cuánto falta/sobra en dólar BCV o dólar físico
  // (efectivo, cotizado a la tasa paralela). Nunca se imprime en el ticket.
  const diferenciaUsdBcv = tasaBcv && tasaBcv > 0 ? Math.round((diferencia / tasaBcv) * 100) / 100 : null;
  const diferenciaUsdEfectivo =
    tasaBinance && tasaBinance > 0 ? Math.round((diferencia / tasaBinance) * 100) / 100 : null;

  function agregarProducto(p: ProductoPos) {
    setCarrito((c) => {
      const existente = c.find((i) => i.producto_id === p.id);
      if (existente) {
        return c.map((i) =>
          i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [
        ...c,
        {
          producto_id: p.id,
          nombre: p.nombre,
          codigo_barras: p.codigo_barras,
          unidad_medida: p.unidad_medida,
          cantidad: 1,
          stock_disponible: p.cantidad,
          precio_venta: p.precio_venta,
          precio_venta_bs: p.precio_venta_bs,
          precio_venta_usd_ajustado: p.precio_venta_usd_ajustado,
          stock_minimo: p.stock_minimo,
          descuento_tipo: null,
          descuento_valor: 0,
        },
      ];
    });
  }

  async function agregarPorCodigo(codigo: string) {
    if (DEMO) {
      const p = demoProductos.find((x) => x.codigo_barras === codigo);
      if (!p) return toast.error("Código no encontrado");
      return agregarProducto(p);
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("productos")
      .select(
        "id, nombre, codigo_barras, unidad_medida, cantidad, stock_minimo, precio_venta, precio_venta_bs, precio_venta_usd_ajustado"
      )
      .eq("codigo_barras", codigo)
      .eq("activo", true)
      .maybeSingle();
    if (!data) return toast.error("Código no encontrado");
    agregarProducto(data as ProductoPos);
  }

  const { valor: valorPistola, onChange: onChangePistola, onKeyDown: onKeyDownPistola } =
    useLectorPistola(agregarPorCodigo);

  function actualizarCantidad(producto_id: string, cantidad: number) {
    setCarrito((c) =>
      c.map((i) =>
        i.producto_id === producto_id ? { ...i, cantidad: Math.max(1, cantidad) } : i
      )
    );
  }

  function quitarItem(producto_id: string) {
    setCarrito((c) => c.filter((i) => i.producto_id !== producto_id));
  }

  function aplicarDescuentoItem(producto_id: string, tipo: TipoDescuento, valor: number, claveUsada: string) {
    setClaveDescuentos(claveUsada);
    setCarrito((c) =>
      c.map((i) => (i.producto_id === producto_id ? { ...i, descuento_tipo: tipo, descuento_valor: valor } : i))
    );
  }

  function quitarDescuentoItem(producto_id: string) {
    setCarrito((c) =>
      c.map((i) => (i.producto_id === producto_id ? { ...i, descuento_tipo: null, descuento_valor: 0 } : i))
    );
  }

  function aplicarDescuentoGeneral(tipo: TipoDescuento, valor: number, claveUsada: string) {
    setClaveDescuentos(claveUsada);
    setDescuentoGeneral({ tipo, valor });
  }

  function quitarDescuentoGeneral() {
    setDescuentoGeneral(null);
  }

  async function validarClave(clave: string): Promise<boolean> {
    if (DEMO) return clave.length >= 4;
    const supabase = createClient();
    const { data } = await supabase.rpc("validar_clave_descuento", { p_clave: clave });
    return !!data;
  }

  function aplicarClienteEncontrado(c: ClientePos) {
    const [tipo, ...resto] = c.cedula.split("-");
    if (tipo === "V" || tipo === "E" || tipo === "J") {
      setClienteTipoDoc(tipo);
      setClienteNumeroDoc(resto.join("-"));
    }
    setClienteNombre(c.nombre ?? "");
    setClienteApellido(c.apellido ?? "");
    setClienteTelefono(c.telefono ?? "");
    setClienteDireccion(c.direccion ?? "");
    toast.success("Cliente encontrado, datos autocompletados");
  }

  useEffect(() => {
    if (clienteNumeroDoc.trim().length < 5) return;
    const cedula = clienteCedula;
    const t = setTimeout(async () => {
      if (DEMO) {
        const c = demoClientesPos.find((x) => x.cedula === cedula);
        if (c) aplicarClienteEncontrado(c);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.rpc("buscar_cliente_pos", { p_cedula: cedula });
      if (data) aplicarClienteEncontrado(data as ClientePos);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteCedula]);

  function agregarLineaPago() {
    const primero = metodosPago[0];
    const moneda: MonedaPago = primero && primero.moneda !== "AMBAS" ? (primero.moneda as MonedaPago) : "BS";
    setPagos((ps) => [...ps, { metodo: primero?.tipo ?? "Efectivo", moneda, monto: "", referencia: "" }]);
  }

  function actualizarMetodoPago(i: number, metodo: string) {
    const m = metodosPago.find((x) => x.tipo === metodo);
    const moneda: MonedaPago = m && m.moneda !== "AMBAS" ? (m.moneda as MonedaPago) : "BS";
    setPagos((ps) => ps.map((p, idx) => (idx === i ? { ...p, metodo, moneda } : p)));
  }

  function actualizarMonedaPago(i: number, moneda: MonedaPago) {
    setPagos((ps) => ps.map((p, idx) => (idx === i ? { ...p, moneda } : p)));
  }

  function actualizarMontoPago(i: number, monto: string) {
    setPagos((ps) => ps.map((p, idx) => (idx === i ? { ...p, monto } : p)));
  }

  function actualizarReferenciaPago(i: number, referencia: string) {
    setPagos((ps) => ps.map((p, idx) => (idx === i ? { ...p, referencia } : p)));
  }

  function quitarPago(i: number) {
    setPagos((ps) => ps.filter((_, idx) => idx !== i));
  }

  function completarPago(i: number) {
    const p = pagos[i];
    const otrosBs = pagos.reduce((s, pp, idx) => (idx === i ? s : s + montoALineaBs(pp)), 0);
    const restanteBs = Math.max(0, Math.round((totalConImpuestos - otrosBs) * 100) / 100);
    let monto = restanteBs;
    if (p.moneda === "USD") {
      if (!tasaBcv || tasaBcv <= 0) return toast.error("No hay tasa BCV configurada");
      monto = Math.round((restanteBs / tasaBcv) * 100) / 100;
    }
    setPagos((ps) => ps.map((pp, idx) => (idx === i ? { ...pp, monto: String(monto) } : pp)));
  }

  async function cobrar() {
    if (carrito.length === 0) return toast.error("El carrito está vacío");
    if (pagos.length === 0) return toast.error("Agrega un método de pago");
    if (!pagosCuadran) return toast.error("Los pagos no cuadran con el total");
    if (pagos.some((p) => p.metodo === "Crédito") && !clienteCedula.trim()) {
      return toast.error("Identifica al cliente (cédula) para una venta a crédito");
    }

    setCobrando(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 500));
      setCobrando(false);
      setResultado({
        pedido_id: crypto.randomUUID(),
        numero_venta: Math.floor(Math.random() * 900) + 100,
        total_bs: totalConImpuestos,
        subtotal_bs: subtotalBruto,
        descuento_monto_bs: descItems + descGeneralBs,
        base_imponible_bs: totalBs,
        iva_monto_bs: ivaBs,
        igtf_monto_bs: igtfTotalBs,
      });
      return toast.success("(Demo) Venta registrada");
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc("crear_venta_pos", {
      p_items: carrito.map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        descuento_tipo: i.descuento_tipo,
        descuento_valor: i.descuento_valor || null,
      })),
      p_pagos: pagos.map((p) => ({
        metodo: p.metodo,
        moneda: p.moneda,
        monto: Number(p.monto) || 0,
        referencia: p.referencia.trim() || null,
      })),
      p_cliente_cedula: clienteCedula.trim() || null,
      p_cliente_nombre: clienteNombre.trim() || null,
      p_cliente_apellido: clienteApellido.trim() || null,
      p_cliente_direccion: clienteDireccion.trim() || null,
      p_cliente_telefono: clienteTelefono.trim() || null,
      p_descuento_general_tipo: descuentoGeneral?.tipo ?? null,
      p_descuento_general_valor: descuentoGeneral?.valor ?? null,
      p_clave_descuentos: claveDescuentos,
      p_turno_id: turno?.id ?? null,
      p_aplica_iva: aplicarIva,
      p_aplica_igtf: aplicarIgtf,
    });
    setCobrando(false);
    if (error) return toast.error(error.message);
    setResultado(data as ResultadoVentaPos);
    toast.success("Venta registrada");
  }

  function nuevaVenta() {
    setCarrito([]);
    setPagos([]);
    setClienteTipoDoc("V");
    setClienteNumeroDoc("");
    setClienteNombre("");
    setClienteApellido("");
    setClienteTelefono("");
    setClienteDireccion("");
    setDescuentoGeneral(null);
    setClaveDescuentos(null);
    setAplicarIva(false);
    setAplicarIgtf(false);
    setResultado(null);
  }

  async function abrirTurno() {
    setAbriendoTurno(true);
    const monto = Number(montoApertura) || 0;
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 300));
      setTurno({
        id: crypto.randomUUID(),
        negocio_id: "demo-negocio",
        usuario_id: "demo-user",
        monto_apertura_bs: monto,
        monto_cierre_bs: null,
        abierto_at: new Date().toISOString(),
        cerrado_at: null,
        estado: "abierto",
      });
      setAbriendoTurno(false);
      setMontoApertura("");
      return toast.success("(Demo) Caja abierta");
    }
    const supabase = createClient();
    const { data, error } = await supabase.rpc("abrir_turno", { p_monto_apertura: monto });
    setAbriendoTurno(false);
    if (error) return toast.error(error.message);
    const turnoId = (data as { turno_id: string }).turno_id;
    setTurno({
      id: turnoId,
      negocio_id: "",
      usuario_id: "",
      monto_apertura_bs: monto,
      monto_cierre_bs: null,
      abierto_at: new Date().toISOString(),
      cerrado_at: null,
      estado: "abierto",
    });
    setMontoApertura("");
    toast.success("Caja abierta");
  }

  async function abrirDialogoCierre() {
    if (!turno) return;
    setDialogCajaAbierto(true);
    setCargandoArqueo(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 200));
      setArqueo(demoArqueo(turno));
      setCargandoArqueo(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.rpc("arqueo_turno", { p_turno_id: turno.id });
    setCargandoArqueo(false);
    if (error) return toast.error(error.message);
    setArqueo(data as ArqueoTurno);
  }

  async function cerrarTurno() {
    if (!turno) return;
    setCerrandoTurno(true);
    const monto = Number(montoCierre) || 0;
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 300));
      setArqueo((a) => (a ? { ...a, monto_cierre_bs: monto, estado: "cerrado", cerrado_at: new Date().toISOString() } : a));
      setCerrandoTurno(false);
      setTurno(null);
      return toast.success("(Demo) Caja cerrada");
    }
    const supabase = createClient();
    const { data, error } = await supabase.rpc("cerrar_turno", {
      p_turno_id: turno.id,
      p_monto_cierre: monto,
    });
    setCerrandoTurno(false);
    if (error) return toast.error(error.message);
    setArqueo(data as ArqueoTurno);
    setTurno(null);
    router.refresh();
    toast.success("Caja cerrada");
  }

  function cerrarDialogoCierre() {
    setDialogCajaAbierto(false);
    setArqueo(null);
    setMontoCierre("");
  }

  // --- Confirmación + ticket (tras cobrar) ---
  if (resultado) {
    const alertas = carrito.filter(
      (i) => i.stock_minimo > 0 && i.stock_disponible - i.cantidad <= i.stock_minimo
    );
    return (
      <div className="space-y-4 animate-in-up">
        <div className="rounded-xl gradient-cyan text-white glow-cyan p-4 text-center print:hidden">
          <p className="text-sm opacity-90">Venta registrada</p>
          <p className="text-2xl font-bold">Venta #{resultado.numero_venta}</p>
        </div>

        {alertas.length > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 print:hidden">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Quedan pocas unidades</p>
              <ul className="list-disc pl-4">
                {alertas.map((a) => (
                  <li key={a.producto_id}>
                    {a.nombre}: quedan {a.stock_disponible - a.cantidad} {a.unidad_medida}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <VistaTicket
          negocioNombre={negocioNombre}
          numeroVenta={resultado.numero_venta}
          createdAt={new Date().toISOString()}
          items={itemsCalc.map((c) => ({
            nombre: c.item.nombre,
            cantidad: c.item.cantidad,
            precio_bs: c.item.precio_venta_bs,
            subtotal_bs: c.neto,
            descuento_monto_bs: c.descMonto,
          }))}
          pagos={pagos.map((p) => ({
            metodo: p.metodo,
            moneda: p.moneda,
            monto_moneda: Number(p.monto) || 0,
            monto_bs: montoALineaBs(p),
          }))}
          subtotalBs={resultado.subtotal_bs}
          descuentoBs={resultado.descuento_monto_bs}
          totalBs={resultado.total_bs}
          ivaBs={resultado.iva_monto_bs}
          igtfBs={resultado.igtf_monto_bs}
          clienteCedula={clienteCedula || null}
          clienteNombre={clienteNombre || null}
          clienteApellido={clienteApellido || null}
          clienteDireccion={clienteDireccion || null}
          clienteTelefono={clienteTelefono || null}
        />

        <Button variant="secondary" className="w-full h-11 print:hidden" onClick={nuevaVenta}>
          Nueva venta
        </Button>
      </div>
    );
  }

  // --- Sin turno abierto: exige abrir caja antes de vender ---
  if (!turno) {
    return (
      <div className="space-y-4 animate-in-up">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gradient">Caja</h1>
          <Link href="/pos/cotizacion" className="text-xs text-brand-cyan font-medium">
            Cotización
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> Abrir caja
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Registra el monto inicial en efectivo (Bs) para abrir tu turno de caja.
            </p>
            <div className="space-y-1">
              <Label>Monto de apertura (Bs)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={montoApertura}
                onChange={(e) => setMontoApertura(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button onClick={abrirTurno} disabled={abriendoTurno} className="w-full h-11">
              {abriendoTurno ? "Abriendo…" : "Abrir caja"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Armado de la venta ---
  return (
    <div className="space-y-4 animate-in-up">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gradient">Caja</h1>
        <Button variant="outline" size="sm" onClick={abrirDialogoCierre}>
          <Lock className="h-4 w-4" /> Cerrar caja
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 -mt-2">
        <p className="text-xs text-muted-foreground">
          Turno abierto {formatFecha(turno.abierto_at)} · Apertura: {formatBs(turno.monto_apertura_bs)}
        </p>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <Link href="/pos/cotizacion" className="text-brand-cyan font-medium">
            Cotización
          </Link>
          <Link href="/pos/historial" className="text-brand-cyan font-medium">
            Historial
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label>Escanear con pistola</Label>
            <Input
              placeholder="Apunta y dispara…"
              value={valorPistola}
              onChange={onChangePistola}
              onKeyDown={onKeyDownPistola}
            />
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={() => setEscanerAbierto(true)}>
            <Camera className="h-4 w-4" /> Escanear con cámara
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-1">
        <Label>Buscar producto</Label>
        <BuscadorPos onSeleccionar={agregarProducto} />
      </div>

      {escanerAbierto && (
        <EscanerBarcode
          onDetectado={(codigo) => {
            setEscanerAbierto(false);
            agregarPorCodigo(codigo);
          }}
          onCerrar={() => setEscanerAbierto(false)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Carrito ({carrito.length})
            {carrito.length > 0 && (
              <button
                type="button"
                className="text-xs text-brand-cyan font-medium"
                onClick={() => setMostrarUsd((v) => !v)}
              >
                {mostrarUsd ? "Ocultar" : "Ver"} ref. USD
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {carrito.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">
              Agrega productos con la pistola, la cámara o el buscador.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {itemsCalc.map(({ item: i, bruto, descMonto, neto }) => (
                <li key={i.producto_id} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{i.nombre}</p>
                    <button type="button" onClick={() => quitarItem(i.producto_id)} aria-label="Quitar">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => actualizarCantidad(i.producto_id, i.cantidad - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <input
                        type="number"
                        className="w-12 text-center bg-transparent border border-input rounded-md h-7 text-sm"
                        value={i.cantidad}
                        onChange={(e) => actualizarCantidad(i.producto_id, Number(e.target.value) || 1)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => actualizarCantidad(i.producto_id, i.cantidad + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground">{i.unidad_medida}</span>
                    </div>
                    <div className="text-right">
                      {descMonto > 0 && (
                        <p className="text-[11px] text-muted-foreground line-through">{formatBs(bruto)}</p>
                      )}
                      <p className="text-sm font-semibold text-brand-cyan">{formatBs(neto)}</p>
                      {mostrarUsd && (
                        <p className="text-[11px] text-brand-amber">
                          {formatUSD(i.cantidad * i.precio_venta)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {descMonto > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <Percent className="h-3 w-3" />
                        Descuento: -{formatBs(descMonto)}
                        <button
                          type="button"
                          onClick={() => quitarDescuentoItem(i.producto_id)}
                          aria-label="Quitar descuento"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-[11px] text-brand-cyan font-medium inline-flex items-center gap-1"
                        onClick={() => setModalDescuento({ tipo: "item", productoId: i.producto_id, nombre: i.nombre })}
                      >
                        <Percent className="h-3 w-3" /> Descuento
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {mostrarUsd && carrito.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Precio en divisas de <b>solo uso interno</b>: nunca mostrar ni imprimir al cliente. Es el
            precio de venta cargado en el inventario. Total a cobrar en divisas: {formatUSD(totalUsdRef)}
          </span>
        </div>
      )}

      {carrito.length > 0 && (
        <div className="rounded-xl glass p-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatBs(subtotalBruto)}</span>
          </div>
          {descItems > 0 && (
            <div className="flex items-center justify-between text-sm text-amber-600 dark:text-amber-400">
              <span>Descuento por producto</span>
              <span>-{formatBs(descItems)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Descuento general</span>
            {descuentoGeneral ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                -{formatBs(descGeneralBs)} (
                {descuentoGeneral.tipo === "porcentaje" ? `${descuentoGeneral.valor}%` : formatBs(descuentoGeneral.valor)}
                )
                <button type="button" onClick={quitarDescuentoGeneral} aria-label="Quitar descuento general">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="text-xs text-brand-cyan font-medium"
                onClick={() => setModalDescuento({ tipo: "general" })}
              >
                Aplicar descuento
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border/40">
            <span className="text-muted-foreground">IVA ({ivaTasa}%)</span>
            <button
              type="button"
              onClick={() => setAplicarIva((v) => !v)}
              className={cn(
                "text-xs font-medium px-2 py-1 rounded-md border transition-colors",
                aplicarIva
                  ? "border-brand-cyan bg-brand-cyan/10 text-brand-cyan"
                  : "border-border text-muted-foreground"
              )}
            >
              {aplicarIva ? `Aplicado: ${formatBs(ivaBs)}` : "Aplicar IVA"}
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">IGTF ({igtfTasa}% en divisas)</span>
            <button
              type="button"
              onClick={() => setAplicarIgtf((v) => !v)}
              className={cn(
                "text-xs font-medium px-2 py-1 rounded-md border transition-colors",
                aplicarIgtf
                  ? "border-brand-amber bg-brand-amber/10 text-brand-amber"
                  : "border-border text-muted-foreground"
              )}
            >
              {aplicarIgtf ? "Activado" : "Aplicar IGTF"}
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className="text-sm text-muted-foreground">Total a cobrar</span>
            <span className="text-2xl font-bold text-gradient">{formatBs(totalConImpuestos)}</span>
          </div>
          {aplicarIgtf && (
            <p className="text-xs text-brand-amber">
              {igtfTotalBs > 0
                ? `+ IGTF por cobrar en divisas: ${formatBs(igtfTotalBs)} (adicional, no incluido arriba)`
                : "El IGTF se calculará al agregar un pago en divisas ($)."}
            </p>
          )}
        </div>
      )}

      {carrito.length > 0 && (
        <Card className={requiereCliente && !clienteCedula.trim() ? "!border-destructive/50" : undefined}>
          <CardHeader>
            <CardTitle className="text-base">
              {requiereCliente ? "Cliente (requerido para venta a crédito)" : "Cliente (opcional)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Cédula / RIF</Label>
              <div className="flex gap-2">
                <Select
                  value={clienteTipoDoc}
                  onValueChange={(v) => v && setClienteTipoDoc(v as TipoDocumento)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="V">V</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                    <SelectItem value="J">J</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1"
                  inputMode="numeric"
                  value={clienteNumeroDoc}
                  onChange={(e) => setClienteNumeroDoc(e.target.value)}
                  placeholder="12345678"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Apellido</Label>
              <Input value={clienteApellido} onChange={(e) => setClienteApellido(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Dirección</Label>
              <Input value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}

      {carrito.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Métodos de pago
              <Button type="button" variant="secondary" size="sm" onClick={agregarLineaPago}>
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pagos.length === 0 && (
              <p className="text-sm text-muted-foreground">Agrega al menos un método de pago.</p>
            )}
            {pagos.map((p, i) => {
              const metodoInfo = metodosPago.find((m) => m.tipo === p.metodo);
              const monedaMetodo = metodoInfo?.moneda ?? "BS";
              return (
                <div key={i} className="space-y-1.5 rounded-lg border border-border/40 p-2">
                  <div className="flex items-center gap-2">
                    <Select value={p.metodo} onValueChange={(v) => v && actualizarMetodoPago(i, v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {metodosPago.map((m) => (
                          <SelectItem key={m.id} value={m.tipo}>
                            {m.tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button type="button" onClick={() => quitarPago(i)} aria-label="Quitar pago">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {monedaMetodo === "AMBAS" && (
                      <Select value={p.moneda} onValueChange={(v) => v && actualizarMonedaPago(i, v as MonedaPago)}>
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BS">Bs</SelectItem>
                          <SelectItem value="USD">Divisas ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      className="flex-1"
                      placeholder={p.moneda === "USD" ? "Monto en $" : "Monto en Bs"}
                      value={p.monto}
                      onChange={(e) => actualizarMontoPago(i, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => completarPago(i)}
                      className="text-xs text-brand-cyan font-medium shrink-0"
                    >
                      Completar
                    </button>
                  </div>
                  {metodosConReferencia.has(p.metodo) && (
                    <Input
                      className="text-sm"
                      placeholder="N° de referencia / confirmación"
                      value={p.referencia}
                      onChange={(e) => actualizarReferenciaPago(i, e.target.value)}
                    />
                  )}
                  {aplicarIgtf && p.moneda === "USD" && Number(p.monto) > 0 && (
                    <p className="text-[11px] text-brand-amber">
                      + IGTF ({igtfTasa}%): {formatBs(igtfDeLinea(p))} adicional en esta línea
                    </p>
                  )}
                </div>
              );
            })}
            {pagos.length > 0 && (
              <div className="text-xs text-right">
                <p className={pagosCuadran ? "text-emerald-600" : "text-destructive"}>
                  {pagosCuadran ? "Pagos completos" : `Diferencia: ${formatBs(diferencia)}`}
                </p>
                {!pagosCuadran && (diferenciaUsdBcv !== null || diferenciaUsdEfectivo !== null) && (
                  <p className="text-muted-foreground">
                    {diferenciaUsdBcv !== null && <>≈ {formatUSD(diferenciaUsdBcv)} BCV</>}
                    {diferenciaUsdBcv !== null && diferenciaUsdEfectivo !== null && " · "}
                    {diferenciaUsdEfectivo !== null && <>≈ {formatUSD(diferenciaUsdEfectivo)} efectivo</>}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {carrito.length > 0 && (
        <Button
          onClick={cobrar}
          disabled={cobrando || !pagosCuadran || pagos.length === 0}
          className="w-full h-12"
        >
          {cobrando ? "Procesando…" : "Cobrar"}
        </Button>
      )}

      <ModalDescuento
        abierto={!!modalDescuento}
        onCerrar={() => setModalDescuento(null)}
        titulo={
          modalDescuento?.tipo === "item"
            ? `Descuento: ${modalDescuento.nombre}`
            : "Descuento general de la venta"
        }
        claveCacheada={claveDescuentos}
        onValidarClave={validarClave}
        onAplicar={(tipo, valor, claveUsada) => {
          if (modalDescuento?.tipo === "item") {
            aplicarDescuentoItem(modalDescuento.productoId, tipo, valor, claveUsada);
          } else if (modalDescuento?.tipo === "general") {
            aplicarDescuentoGeneral(tipo, valor, claveUsada);
          }
        }}
      />

      <Dialog open={dialogCajaAbierto} onOpenChange={(o) => !o && cerrarDialogoCierre()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{arqueo?.estado === "cerrado" ? "Caja cerrada" : "Cerrar caja"}</DialogTitle>
          </DialogHeader>
          {cargandoArqueo || !arqueo ? (
            <p className="text-sm text-muted-foreground py-4">Calculando arqueo…</p>
          ) : (
            <div id="ticket-imprimible" className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Apertura</span>
                <span className="font-medium">{formatBs(arqueo.monto_apertura_bs)}</span>
              </div>
              {Object.entries(arqueo.por_metodo).map(([metodo, monto]) => (
                <div key={metodo} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{metodo}</span>
                  <span className="font-medium">{formatBs(monto)}</span>
                </div>
              ))}
              <div className="border-t border-border/50 pt-2 flex items-center justify-between font-semibold">
                <span>Total ventas ({arqueo.ventas})</span>
                <span>{formatBs(arqueo.total_ventas_bs)}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span>Esperado en caja</span>
                <span className="text-gradient">{formatBs(arqueo.esperado_bs)}</span>
              </div>
              {arqueo.pendiente_por_cobrar_bs > 0 && (
                <div className="flex items-center justify-between text-amber-600">
                  <span>Créditos pendientes por cobrar</span>
                  <span className="font-medium">{formatBs(arqueo.pendiente_por_cobrar_bs)}</span>
                </div>
              )}

              {arqueo.estado === "cerrado" ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Contado</span>
                    <span className="font-medium">{formatBs(arqueo.monto_cierre_bs ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span>Diferencia</span>
                    <span
                      className={
                        Math.abs((arqueo.monto_cierre_bs ?? 0) - arqueo.esperado_bs) < 0.5
                          ? "text-emerald-600"
                          : "text-destructive"
                      }
                    >
                      {formatBs((arqueo.monto_cierre_bs ?? 0) - arqueo.esperado_bs)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="space-y-1 pt-2 print:hidden">
                  <Label>Monto contado (Bs)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={montoCierre}
                    onChange={(e) => setMontoCierre(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="print:hidden">
            {arqueo?.estado === "cerrado" ? (
              <>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
                <Button onClick={cerrarDialogoCierre}>Aceptar</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={cerrarDialogoCierre}>
                  Cancelar
                </Button>
                <Button onClick={cerrarTurno} disabled={cerrandoTurno || cargandoArqueo}>
                  {cerrandoTurno ? "Cerrando…" : "Confirmar cierre"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
