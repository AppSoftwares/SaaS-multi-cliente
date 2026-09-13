"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Printer, X } from "lucide-react";
import { formatBs, formatFecha, formatUSD } from "@/lib/format";
import { BuscadorPos } from "@/components/pos/buscador-pos";
import { linkWhatsApp } from "@/lib/whatsapp";
import type { ItemCotizacionResultado, MonedaCotizacion, ProductoPos, ResultadoCotizacion } from "@/lib/types";

interface ItemCarritoCotizacion {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_venta: number;
  precio_venta_bs: number;
}

export function CotizacionCliente({ negocioNombre }: { negocioNombre: string }) {
  const [carrito, setCarrito] = useState<ItemCarritoCotizacion[]>([]);
  const [moneda, setMoneda] = useState<MonedaCotizacion>("BS");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<{
    numero: number;
    items: ItemCotizacionResultado[];
    total: number;
    moneda: MonedaCotizacion;
  } | null>(null);

  function precioUnit(i: ItemCarritoCotizacion) {
    return moneda === "USD" ? i.precio_venta : i.precio_venta_bs;
  }

  const total = carrito.reduce((s, i) => s + i.cantidad * precioUnit(i), 0);

  function agregarProducto(p: ProductoPos) {
    setCarrito((c) => {
      const existente = c.find((i) => i.producto_id === p.id);
      if (existente) {
        return c.map((i) => (i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [
        ...c,
        {
          producto_id: p.id,
          nombre: p.nombre,
          cantidad: 1,
          precio_venta: p.precio_venta,
          precio_venta_bs: p.precio_venta_bs,
        },
      ];
    });
  }

  function actualizarCantidad(producto_id: string, cantidad: number) {
    setCarrito((c) => c.map((i) => (i.producto_id === producto_id ? { ...i, cantidad: Math.max(1, cantidad) } : i)));
  }

  function quitarItem(producto_id: string) {
    setCarrito((c) => c.filter((i) => i.producto_id !== producto_id));
  }

  async function generarCotizacion() {
    if (carrito.length === 0) return toast.error("Agrega al menos un producto");
    setGenerando(true);

    if (DEMO) {
      await new Promise((r) => setTimeout(r, 400));
      setGenerando(false);
      setResultado({
        numero: Math.floor(Math.random() * 900) + 100,
        moneda,
        total,
        items: carrito.map((i) => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio_unit: precioUnit(i),
          subtotal: i.cantidad * precioUnit(i),
        })),
      });
      return toast.success("(Demo) Cotización generada");
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc("crear_cotizacion", {
      p_moneda: moneda,
      p_items: carrito.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
      p_cliente_nombre: clienteNombre.trim() || null,
      p_cliente_telefono: clienteTelefono.trim() || null,
    });
    setGenerando(false);
    if (error) return toast.error(error.message);
    const r = data as ResultadoCotizacion;
    setResultado({
      numero: r.numero_cotizacion,
      moneda,
      total: r.total,
      items: carrito.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unit: precioUnit(i),
        subtotal: i.cantidad * precioUnit(i),
      })),
    });
    toast.success("Cotización generada");
  }

  function nuevaCotizacion() {
    setCarrito([]);
    setClienteNombre("");
    setClienteTelefono("");
    setResultado(null);
  }

  function fmt(n: number) {
    return resultado?.moneda === "USD" ? formatUSD(n) : formatBs(n);
  }

  if (resultado) {
    const mensaje = [
      `Cotización #${resultado.numero} — ${negocioNombre}`,
      formatFecha(new Date().toISOString()),
      clienteNombre ? `Cliente: ${clienteNombre}` : null,
      "",
      ...resultado.items.map(
        (it) => `${it.nombre}\n  ${it.cantidad} x ${fmt(it.precio_unit)} = ${fmt(it.subtotal)}`
      ),
      "",
      `TOTAL: ${fmt(resultado.total)}`,
      "",
      resultado.moneda === "USD" ? "Precio en divisas de referencia interna." : null,
    ]
      .filter(Boolean)
      .join("\n");

    return (
      <div className="space-y-4 animate-in-up">
        <div className="rounded-xl gradient-cyan text-white glow-cyan p-4 text-center print:hidden">
          <p className="text-sm opacity-90">Cotización generada</p>
          <p className="text-2xl font-bold">Cotización #{resultado.numero}</p>
        </div>

        <div id="ticket-imprimible" className="glass rounded-2xl p-4 font-mono text-sm space-y-2 max-w-xs mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="" className="mx-auto h-10 w-auto object-contain" />
          <p className="text-center font-bold">{negocioNombre}</p>
          <p className="text-center text-xs">Cotización #{resultado.numero}</p>
          <p className="text-center text-xs text-muted-foreground">{formatFecha(new Date().toISOString())}</p>
          {clienteNombre && <p className="text-xs">Cliente: {clienteNombre}</p>}
          <div className="border-t border-dashed border-border pt-2 space-y-1.5">
            {resultado.items.map((it, i) => (
              <div key={i} className="text-xs">
                <p>{it.nombre}</p>
                <div className="flex justify-between">
                  <span>
                    {it.cantidad} x {fmt(it.precio_unit)}
                  </span>
                  <span>{fmt(it.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-border pt-2 flex justify-between font-bold">
            <span>TOTAL</span>
            <span>{fmt(resultado.total)}</span>
          </div>
          {resultado.moneda === "USD" && (
            <p className="text-center text-[10px] text-muted-foreground pt-1">
              Precio en divisas de referencia interna
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Descargar PDF
          </Button>
          <a href={linkWhatsApp(mensaje, clienteTelefono)} target="_blank" rel="noreferrer">
            <Button className="w-full">Enviar por WhatsApp</Button>
          </a>
        </div>
        <Button variant="secondary" className="w-full h-11 print:hidden" onClick={nuevaCotizacion}>
          Nueva cotización
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in-up">
      <Link href="/pos" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Caja
      </Link>
      <h1 className="text-2xl font-bold text-gradient">Cotización</h1>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={moneda} onValueChange={(v) => v && setMoneda(v as MonedaCotizacion)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BS">Bolívares (Bs)</SelectItem>
                <SelectItem value="USD">Divisas ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1">
        <Label>Buscar producto</Label>
        <BuscadorPos onSeleccionar={agregarProducto} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ítems ({carrito.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {carrito.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Agrega productos con el buscador.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {carrito.map((i) => (
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
                    </div>
                    <span className="text-sm font-semibold text-brand-cyan">
                      {moneda === "USD" ? formatUSD(i.cantidad * precioUnit(i)) : formatBs(i.cantidad * precioUnit(i))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {carrito.length > 0 && (
        <div className="rounded-xl glass p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-bold text-gradient">
            {moneda === "USD" ? formatUSD(total) : formatBs(total)}
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente (opcional)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={generarCotizacion} disabled={generando || carrito.length === 0} className="w-full h-12">
        {generando ? "Generando…" : "Generar cotización"}
      </Button>
    </div>
  );
}
