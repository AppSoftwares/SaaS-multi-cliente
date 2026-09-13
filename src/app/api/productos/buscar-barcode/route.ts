import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const COLUMNAS =
  "id, nombre, sku, codigo_barras, categoria, categoria_id, marca, unidad_medida, precio_venta";

// Busca un producto ya existente por código de barras o SKU (RLS limita al
// negocio del usuario). Se usa para autocompletar categoría/marca/unidad al
// cargar una factura o crear un producto manualmente.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const codigoBarras = req.nextUrl.searchParams.get("codigo_barras")?.trim();
  const sku = req.nextUrl.searchParams.get("sku")?.trim();
  if (!codigoBarras && !sku) {
    return NextResponse.json({ producto: null });
  }

  if (codigoBarras) {
    const { data } = await supabase
      .from("productos")
      .select(COLUMNAS)
      .eq("codigo_barras", codigoBarras)
      .limit(1)
      .maybeSingle();
    if (data) return NextResponse.json({ producto: data });
  }

  if (sku) {
    const { data } = await supabase
      .from("productos")
      .select(COLUMNAS)
      .eq("sku", sku)
      .limit(1)
      .maybeSingle();
    if (data) return NextResponse.json({ producto: data });
  }

  return NextResponse.json({ producto: null });
}
