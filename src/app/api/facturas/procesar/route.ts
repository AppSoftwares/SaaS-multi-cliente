import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extraerDatosFactura } from "@/lib/openai";
import { escapeLike } from "@/lib/utils";
import { permitido } from "@/lib/rate-limit";
import { requirePermisoFacturas } from "@/lib/facturas-auth";
import type { Producto, ResultadoProcesarFactura, ItemFacturaProcesado } from "@/lib/types";

export const runtime = "nodejs";

// Procesa la foto de una factura de proveedor con IA y concilia cada línea
// contra el inventario existente (mismo criterio que /api/procesar-ia).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const guard = await requirePermisoFacturas(supabase, user.id);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  if (!permitido(user.id)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento." },
      { status: 429 }
    );
  }

  let body: { imagenUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const imagenUrl = (body.imagenUrl ?? "").toString();
  if (!imagenUrl) {
    return NextResponse.json({ error: "Se requiere la foto de la factura" }, { status: 400 });
  }

  let datosIA;
  try {
    datosIA = await extraerDatosFactura(imagenUrl);
  } catch (e) {
    console.error("Error OpenAI (factura):", e);
    return NextResponse.json({ error: "No se pudo procesar la factura con la IA" }, { status: 502 });
  }

  const columnas =
    "id, negocio_id, sku, codigo_barras, nombre, descripcion, categoria, categoria_id, marca, unidad_medida, cantidad, stock_minimo, stock_maximo, precio_venta, imagen_url, proveedor, proveedor_id, activo, ubicacion, created_by, created_at, updated_at, precio_venta_bs, precio_venta_usd_ajustado";

  const items: ItemFacturaProcesado[] = [];
  for (const itemIA of datosIA.items) {
    let existente: Producto | null = null;

    if (itemIA.codigo_barras) {
      const { data } = await supabase
        .from("productos")
        .select(columnas)
        .eq("codigo_barras", itemIA.codigo_barras)
        .limit(1)
        .maybeSingle();
      existente = (data as Producto) ?? null;
    }

    if (!existente && itemIA.sku) {
      const { data } = await supabase
        .from("productos")
        .select(columnas)
        .eq("sku", itemIA.sku)
        .limit(1)
        .maybeSingle();
      existente = (data as Producto) ?? null;
    }

    if (!existente && itemIA.nombre?.trim()) {
      const patron = `%${escapeLike(itemIA.nombre.trim())}%`;
      const { data } = await supabase
        .from("productos")
        .select(columnas)
        .ilike("nombre", patron)
        .limit(1)
        .maybeSingle();
      existente = (data as Producto) ?? null;
    }

    items.push(
      existente
        ? { status: "EXISTING", item_ia: itemIA, producto_bd: existente }
        : { status: "NEW", item_ia: itemIA }
    );
  }

  const resultado: ResultadoProcesarFactura = {
    numero_factura: datosIA.numero_factura,
    fecha: datosIA.fecha,
    proveedor_nombre: datosIA.proveedor_nombre,
    moneda: datosIA.moneda,
    monto_total: datosIA.monto_total,
    dias_credito: datosIA.dias_credito ?? null,
    items,
  };

  return NextResponse.json(resultado);
}
