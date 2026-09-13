import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Confirma el wizard: suma stock a un producto existente, o crea uno nuevo.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: rolRow } = await supabase
    .from("roles_usuario")
    .select("rol, negocio_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!rolRow?.negocio_id) {
    return NextResponse.json({ error: "Usuario sin negocio" }, { status: 403 });
  }
  const esAdmin = rolRow.rol === "ADMIN";
  const negocioId = rolRow.negocio_id;

  const body = await req.json();

  // ---- EXISTING: sumar stock vía RPC atómica ----
  if (body.status === "EXISTING") {
    const { producto_id, cantidad_sumar, nota } = body;
    const cantidad = Number(cantidad_sumar);
    if (!producto_id || !Number.isFinite(cantidad) || cantidad <= 0) {
      return NextResponse.json({ error: "Cantidad a sumar inválida" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("registrar_movimiento", {
      p_producto_id: producto_id,
      p_tipo: "INGRESO",
      p_cantidad: cantidad,
      p_nota: nota ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, cantidad_resultante: data });
  }

  // ---- NEW: crear producto + costo (si admin) + movimiento ALTA ----
  if (body.status === "NEW") {
    const p = body.producto ?? {};
    if (!p.nombre?.toString().trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    const cantidadInicial = Math.max(0, Number(p.cantidad) || 0);

    const { data: nuevo, error: errInsert } = await supabase
      .from("productos")
      .insert({
        negocio_id: negocioId,
        nombre: p.nombre.toString().trim(),
        sku: p.sku || null,
        codigo_barras: p.codigo_barras || null,
        descripcion: p.descripcion || null,
        categoria: p.categoria || null,
        categoria_id: p.categoria_id || null,
        marca: p.marca || null,
        unidad_medida: p.unidad_medida || "Unidad",
        cantidad: 0, // se setea con el movimiento ALTA
        stock_minimo: Math.max(0, Number(p.stock_minimo) || 0),
        precio_venta: Number(p.precio_venta) || 0,
        imagen_url: p.imagen_url || null,
        proveedor: p.proveedor || null,
        proveedor_id: p.proveedor_id || null,
        ubicacion: p.ubicacion || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (errInsert || !nuevo) {
      return NextResponse.json(
        { error: errInsert?.message ?? "No se pudo crear el producto" },
        { status: 400 }
      );
    }

    // Costo: solo si es ADMIN y se envió un valor (la RLS también lo protege)
    if (esAdmin && p.precio_costo != null && p.precio_costo !== "") {
      await supabase.from("productos_costos").insert({
        producto_id: nuevo.id,
        negocio_id: negocioId,
        precio_costo: Number(p.precio_costo) || 0,
      });
    }

    // Movimiento ALTA con la cantidad inicial
    if (cantidadInicial > 0) {
      await supabase.rpc("registrar_movimiento", {
        p_producto_id: nuevo.id,
        p_tipo: "ALTA",
        p_cantidad: cantidadInicial,
        p_nota: "Alta de producto",
      });
    }

    return NextResponse.json({ ok: true, producto_id: nuevo.id });
  }

  return NextResponse.json({ error: "status inválido" }, { status: 400 });
}
