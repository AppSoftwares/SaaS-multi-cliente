import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extraerDatosProducto } from "@/lib/openai";
import { escapeLike } from "@/lib/utils";
import { permitido } from "@/lib/rate-limit";
import type { Producto } from "@/lib/types";

export const runtime = "nodejs";

// Procesa foto + dictado con la IA y detecta si el producto ya existe.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!permitido(user.id)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento." },
      { status: 429 }
    );
  }

  let body: { texto?: string; imagenUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const texto = (body.texto ?? "").toString();
  const imagenUrl = body.imagenUrl ?? null;

  if (!texto.trim() && !imagenUrl) {
    return NextResponse.json(
      { error: "Se requiere una foto o una descripción hablada" },
      { status: 400 }
    );
  }

  // 1) Extraer datos con OpenAI (Structured Outputs + Vision)
  let datosIA;
  try {
    datosIA = await extraerDatosProducto(texto, imagenUrl);
  } catch (e) {
    console.error("Error OpenAI:", e);
    return NextResponse.json({ error: "No se pudo procesar con la IA" }, { status: 502 });
  }

  // 2) Detección de duplicados SEGURA (la RLS ya scopa al negocio del usuario)
  const columnas =
    "id, negocio_id, sku, codigo_barras, nombre, descripcion, categoria, unidad_medida, cantidad, stock_minimo, precio_venta, imagen_url, proveedor, ubicacion, created_by, created_at, updated_at";

  let existente: Producto | null = null;

  // 2a) por código de barras exacto
  if (datosIA.codigo_barras) {
    const { data } = await supabase
      .from("productos")
      .select(columnas)
      .eq("codigo_barras", datosIA.codigo_barras)
      .limit(1)
      .maybeSingle();
    existente = (data as Producto) ?? null;
  }

  // 2b) por SKU exacto
  if (!existente && datosIA.sku) {
    const { data } = await supabase
      .from("productos")
      .select(columnas)
      .eq("sku", datosIA.sku)
      .limit(1)
      .maybeSingle();
    existente = (data as Producto) ?? null;
  }

  // 2c) por nombre similar (ILIKE con término escapado)
  if (!existente && datosIA.nombre?.trim()) {
    const patron = `%${escapeLike(datosIA.nombre.trim())}%`;
    const { data } = await supabase
      .from("productos")
      .select(columnas)
      .ilike("nombre", patron)
      .limit(1)
      .maybeSingle();
    existente = (data as Producto) ?? null;
  }

  if (existente) {
    return NextResponse.json({
      status: "EXISTING",
      producto_bd: existente,
      datos_ia: datosIA,
      mensaje: `Se encontró un producto similar: ${existente.nombre}`,
    });
  }

  return NextResponse.json({ status: "NEW", datos_ia: datosIA });
}
