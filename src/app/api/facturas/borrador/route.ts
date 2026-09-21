import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface ItemBorrador {
  producto_id?: string | null;
  nombre: string;
  sku?: string | null;
  codigo_barras?: string | null;
  cantidad: number;
  precio_costo: number;
  costo_lista?: number | null;
  descuento_pct?: number | null;
  categoria_madre?: string | null;
  categoria_sub?: string | null;
  marca?: string | null;
  unidad_medida?: string | null;
  utilidad_pct?: number | null;
  precio_venta?: number | null;
  es_nuevo: boolean;
}

async function rolAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("roles_usuario")
    .select("rol, negocio_id")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

// Guarda (crea o actualiza) una factura en estado 'borrador' con sus ítems,
// para que el usuario pueda salir del wizard y reabrirla después sin perder
// lo que la IA ya extrajo.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rolRow = await rolAdmin(supabase, user.id);
  if (rolRow?.rol !== "ADMIN" || !rolRow.negocio_id) {
    return NextResponse.json({ error: "Solo un ADMIN puede registrar facturas" }, { status: 403 });
  }
  const negocioId = rolRow.negocio_id;

  const body = await req.json();
  const facturaId: string | undefined = body.facturaId || undefined;
  const f = body.factura ?? {};
  const items: ItemBorrador[] = Array.isArray(body.items) ? body.items : [];

  const datosFactura = {
    negocio_id: negocioId,
    proveedor_id: f.proveedor_id || null,
    // Nombre de un proveedor nuevo tecleado a mano (aún sin resolver a un
    // proveedor real, eso pasa recién en /api/facturas/aplicar): se guarda
    // aparte para no perderlo si el usuario sale y reabre el borrador.
    proveedor_nombre_nuevo: f.proveedor_id ? null : f.proveedor_nombre_nuevo || null,
    numero_factura: f.numero_factura || null,
    fecha: f.fecha || null,
    moneda: f.moneda === "USD" ? "USD" : "BS",
    monto_total: Number(f.monto_total) || 0,
    imagen_url: f.imagen_url || null,
    estado: "borrador" as const,
    updated_at: new Date().toISOString(),
  };

  let idFinal = facturaId;

  if (facturaId) {
    const { data: existente } = await supabase
      .from("facturas")
      .select("id, estado")
      .eq("id", facturaId)
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (!existente || existente.estado !== "borrador") {
      return NextResponse.json({ error: "Borrador no encontrado" }, { status: 404 });
    }
    const { error: errUpd } = await supabase.from("facturas").update(datosFactura).eq("id", facturaId);
    if (errUpd) return NextResponse.json({ error: errUpd.message }, { status: 400 });
    await supabase.from("factura_items").delete().eq("factura_id", facturaId);
  } else {
    const { data: nueva, error: errIns } = await supabase
      .from("facturas")
      .insert({ ...datosFactura, usuario_id: user.id })
      .select("id")
      .single();
    if (errIns || !nueva) {
      return NextResponse.json({ error: errIns?.message ?? "No se pudo crear el borrador" }, { status: 400 });
    }
    idFinal = nueva.id;
  }

  if (items.length > 0 && idFinal) {
    await supabase.from("factura_items").insert(
      items.map((it) => ({
        factura_id: idFinal,
        producto_id: it.producto_id || null,
        nombre: it.nombre,
        sku: it.sku || null,
        codigo_barras: it.codigo_barras || null,
        cantidad: Number(it.cantidad) || 0,
        precio_costo: Number(it.precio_costo) || 0,
        costo_lista: it.costo_lista ?? null,
        descuento_pct: it.descuento_pct ?? null,
        categoria_madre: it.categoria_madre || null,
        categoria_sub: it.categoria_sub || null,
        marca: it.marca || null,
        unidad_medida: it.unidad_medida || null,
        utilidad_pct: it.utilidad_pct ?? null,
        precio_venta_sugerido: it.precio_venta ?? null,
        subtotal: (Number(it.cantidad) || 0) * (Number(it.precio_costo) || 0),
        es_nuevo: !!it.es_nuevo,
        aplicado: false,
      }))
    );
  }

  return NextResponse.json({ facturaId: idFinal });
}

// Lista las facturas en borrador del negocio (para ofrecer "continuar editando").
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rolRow = await rolAdmin(supabase, user.id);
  if (rolRow?.rol !== "ADMIN" || !rolRow.negocio_id) {
    return NextResponse.json({ borradores: [] });
  }

  const { data } = await supabase
    .from("facturas")
    .select("id, numero_factura, proveedor_id, moneda, monto_total, updated_at, proveedores(nombre), factura_items(count)")
    .eq("negocio_id", rolRow.negocio_id)
    .eq("estado", "borrador")
    .order("updated_at", { ascending: false });

  const borradores = (data ?? []).map((f) => {
    const row = f as unknown as {
      id: string;
      numero_factura: string | null;
      proveedor_id: string | null;
      moneda: "BS" | "USD";
      monto_total: number;
      updated_at: string;
      proveedores: { nombre: string } | null;
      factura_items: { count: number }[];
    };
    return {
      id: row.id,
      numero_factura: row.numero_factura,
      proveedor_nombre: row.proveedores?.nombre ?? null,
      moneda: row.moneda,
      monto_total: row.monto_total,
      updated_at: row.updated_at,
      items_count: row.factura_items?.[0]?.count ?? 0,
    };
  });

  return NextResponse.json({ borradores });
}
