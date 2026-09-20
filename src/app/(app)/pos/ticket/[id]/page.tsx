import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { getNegocioNombre } from "@/lib/negocio";
import { VistaTicket } from "@/components/pos/vista-ticket";
import { DEMO, demoVentasPos, demoNegocioNombre } from "@/lib/demo";
import { ArrowLeft } from "lucide-react";
import type { Pedido, PedidoItem, PedidoPago } from "@/lib/types";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await getSesion();

  let pedido: Pick<
    Pedido,
    | "id"
    | "numero_venta"
    | "subtotal_bs"
    | "descuento_monto_bs"
    | "total_bs"
    | "iva_monto_bs"
    | "igtf_monto_bs"
    | "created_at"
    | "cliente_cedula"
    | "cliente_nombre"
    | "cliente_apellido"
    | "cliente_direccion"
    | "cliente_telefono"
    | "costo_delivery"
    | "direccion"
  >;
  let items: Pick<
    PedidoItem,
    "nombre" | "cantidad" | "precio_bs" | "subtotal_bs" | "descuento_monto_bs"
  >[];
  let pagos: Pick<PedidoPago, "metodo" | "moneda" | "monto_moneda" | "monto_bs">[];
  let negocioNombre: string;

  if (DEMO) {
    const v = demoVentasPos.find((x) => x.id === id);
    if (!v) notFound();
    pedido = {
      id: v.id,
      numero_venta: v.numero_venta,
      subtotal_bs: v.total_bs,
      descuento_monto_bs: 0,
      total_bs: v.total_bs,
      iva_monto_bs: 0,
      igtf_monto_bs: 0,
      created_at: v.created_at,
      cliente_cedula: null,
      cliente_nombre: v.cliente_nombre,
      cliente_apellido: null,
      cliente_direccion: null,
      cliente_telefono: null,
      costo_delivery: 0,
      direccion: null,
    };
    items = [
      {
        nombre: "Producto de ejemplo",
        cantidad: 1,
        precio_bs: v.total_bs,
        subtotal_bs: v.total_bs,
        descuento_monto_bs: 0,
      },
    ];
    pagos = [{ metodo: "Efectivo", moneda: "BS", monto_moneda: v.total_bs, monto_bs: v.total_bs }];
    negocioNombre = demoNegocioNombre;
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("pedidos")
      .select(
        "id, numero_venta, subtotal_bs, descuento_monto_bs, total_bs, iva_monto_bs, igtf_monto_bs, created_at, cliente_cedula, cliente_nombre, cliente_apellido, cliente_direccion, cliente_telefono, costo_delivery, direccion"
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) notFound();
    pedido = data;

    const [itemsRes, pagosRes] = await Promise.all([
      supabase
        .from("pedido_items")
        .select("nombre, cantidad, precio_bs, subtotal_bs, descuento_monto_bs")
        .eq("pedido_id", id),
      supabase.from("pedido_pagos").select("metodo, moneda, monto_moneda, monto_bs").eq("pedido_id", id),
    ]);
    items = itemsRes.data ?? [];
    pagos = pagosRes.data ?? [];
    negocioNombre = await getNegocioNombre(sesion?.negocioId ?? null);
  }

  return (
    <div className="space-y-4 animate-in-up">
      <Link href="/pos" className="inline-flex items-center text-sm text-muted-foreground print:hidden">
        <ArrowLeft className="mr-1 h-4 w-4" /> Caja
      </Link>

      <VistaTicket
        negocioNombre={negocioNombre}
        numeroVenta={pedido.numero_venta}
        createdAt={pedido.created_at}
        items={items}
        pagos={pagos}
        subtotalBs={pedido.subtotal_bs}
        descuentoBs={pedido.descuento_monto_bs}
        totalBs={pedido.total_bs}
        ivaBs={pedido.iva_monto_bs}
        igtfBs={pedido.igtf_monto_bs}
        deliveryBs={pedido.costo_delivery}
        direccionEntrega={pedido.direccion}
        clienteCedula={pedido.cliente_cedula}
        clienteNombre={pedido.cliente_nombre}
        clienteApellido={pedido.cliente_apellido}
        clienteDireccion={pedido.cliente_direccion}
        clienteTelefono={pedido.cliente_telefono}
      />
    </div>
  );
}
