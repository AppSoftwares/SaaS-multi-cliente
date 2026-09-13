import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarCodigoBarrasInterno } from "@/lib/barcode";

export const runtime = "nodejs";

interface ItemEntrada {
  status: "EXISTING" | "NEW";
  producto_id?: string | null;
  nombre: string;
  sku?: string | null;
  codigo_barras?: string | null;
  categoria?: string | null;
  categoria_id?: string | null;
  marca?: string | null;
  unidad_medida?: string | null;
  cantidad: number;
  precio_costo: number;
  precio_venta?: number | null;
  aplicar_stock: boolean;
}

// Crea la factura + sus líneas; para cada línea NEW crea el producto (con
// código de barras generado si falta), y si aplicar_stock está activo,
// mueve el stock reutilizando registrar_movimiento (misma fuente de verdad
// de inventario que el resto del sistema).
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
  if (rolRow?.rol !== "ADMIN" || !rolRow.negocio_id) {
    return NextResponse.json({ error: "Solo un ADMIN puede registrar facturas" }, { status: 403 });
  }
  const negocioId = rolRow.negocio_id;

  const body = await req.json();
  const f = body.factura ?? {};
  const items: ItemEntrada[] = Array.isArray(body.items) ? body.items : [];
  const borradorId: string | undefined = body.facturaId || undefined;
  if (items.length === 0) {
    return NextResponse.json({ error: "La factura no tiene ítems" }, { status: 400 });
  }

  const datosFactura = {
    negocio_id: negocioId,
    proveedor_id: f.proveedor_id || null,
    numero_factura: f.numero_factura || null,
    fecha: f.fecha || null,
    moneda: f.moneda === "USD" ? "USD" : "BS",
    monto_total: Number(f.monto_total) || 0,
    pagada: !!f.pagada,
    estado: "revision" as const,
    imagen_url: f.imagen_url || null,
    notas: f.notas || null,
  };

  let factura: { id: string } | null = null;
  let errFactura: { message: string } | null = null;

  if (borradorId) {
    // Convierte un borrador (creado mientras el usuario seguía cargando ítems)
    // en la factura final, en vez de duplicarla.
    const { data: existente } = await supabase
      .from("facturas")
      .select("id")
      .eq("id", borradorId)
      .eq("negocio_id", negocioId)
      .eq("estado", "borrador")
      .maybeSingle();
    if (existente) {
      const { data: actualizada, error } = await supabase
        .from("facturas")
        .update({ ...datosFactura, updated_at: new Date().toISOString() })
        .eq("id", borradorId)
        .select("id")
        .single();
      factura = actualizada;
      errFactura = error;
      if (actualizada) {
        await supabase.from("factura_items").delete().eq("factura_id", actualizada.id);
      }
    }
  }

  if (!factura) {
    const { data: nueva, error } = await supabase
      .from("facturas")
      .insert({ ...datosFactura, usuario_id: user.id })
      .select("id")
      .single();
    factura = nueva;
    errFactura = error;
  }

  if (errFactura || !factura) {
    return NextResponse.json(
      { error: errFactura?.message ?? "No se pudo crear la factura" },
      { status: 400 }
    );
  }

  let huboAplicacion = false;
  const codigosUsados = new Set<string>();
  const creados: { nombre: string; codigo_barras: string; producto_id: string }[] = [];
  const alertasCosto: { nombre: string; costo_anterior: number; costo_nuevo: number; pct: number }[] = [];

  for (const item of items) {
    const cantidad = Math.max(0, Number(item.cantidad) || 0);
    const precioCosto = Number(item.precio_costo) || 0;
    let productoId = item.producto_id || null;

    if (item.status === "NEW") {
      let codigoBarras: string = item.codigo_barras || "";
      if (!codigoBarras) {
        let intento = generarCodigoBarrasInterno();
        for (let i = 0; i < 5 && codigosUsados.has(intento); i++) {
          intento = generarCodigoBarrasInterno();
        }
        codigosUsados.add(intento);
        codigoBarras = intento;
      }

      const { data: nuevo, error: errInsert } = await supabase
        .from("productos")
        .insert({
          negocio_id: negocioId,
          nombre: item.nombre.toString().trim(),
          sku: item.sku || null,
          codigo_barras: codigoBarras,
          categoria: item.categoria || null,
          categoria_id: item.categoria_id || null,
          marca: item.marca || null,
          unidad_medida: item.unidad_medida || "Unidad",
          cantidad: 0,
          stock_minimo: 0,
          precio_venta: Number(item.precio_venta) || 0,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (errInsert || !nuevo) {
        continue; // no se pudo crear este ítem; se deja fuera de la factura
      }
      productoId = nuevo.id;
      creados.push({ nombre: item.nombre, codigo_barras: codigoBarras, producto_id: nuevo.id });

      await supabase.from("productos_costos").insert({
        producto_id: productoId,
        negocio_id: negocioId,
        precio_costo: precioCosto,
      });

      if (item.aplicar_stock && cantidad > 0) {
        await supabase.rpc("registrar_movimiento", {
          p_producto_id: productoId,
          p_tipo: "ALTA",
          p_cantidad: cantidad,
          p_nota: `Factura ${f.numero_factura || factura.id}`,
        });
        huboAplicacion = true;
      }
    } else if (item.status === "EXISTING" && productoId) {
      const { data: costoActual } = await supabase
        .from("productos_costos")
        .select("precio_costo")
        .eq("producto_id", productoId)
        .maybeSingle();

      await supabase
        .from("productos_costos")
        .upsert(
          { producto_id: productoId, negocio_id: negocioId, precio_costo: precioCosto },
          { onConflict: "producto_id" }
        );

      const costoAnterior = costoActual?.precio_costo ?? null;
      if (costoAnterior != null && Number(costoAnterior) !== precioCosto) {
        await supabase.from("historial_costos").insert({
          negocio_id: negocioId,
          producto_id: productoId,
          factura_id: factura.id,
          costo_anterior: costoAnterior,
          costo_nuevo: precioCosto,
          usuario_id: user.id,
        });
        if (precioCosto > Number(costoAnterior)) {
          alertasCosto.push({
            nombre: item.nombre,
            costo_anterior: Number(costoAnterior),
            costo_nuevo: precioCosto,
            pct: Math.round(((precioCosto - Number(costoAnterior)) / Number(costoAnterior)) * 1000) / 10,
          });
        }
      }

      if (item.aplicar_stock && cantidad > 0) {
        await supabase.rpc("registrar_movimiento", {
          p_producto_id: productoId,
          p_tipo: "INGRESO",
          p_cantidad: cantidad,
          p_nota: `Factura ${f.numero_factura || factura.id}`,
        });
        huboAplicacion = true;
      }
    }

    await supabase.from("factura_items").insert({
      factura_id: factura.id,
      producto_id: productoId,
      nombre: item.nombre,
      sku: item.sku || null,
      codigo_barras: item.codigo_barras || null,
      cantidad,
      precio_costo: precioCosto,
      precio_venta_sugerido: item.precio_venta ?? null,
      subtotal: cantidad * precioCosto,
      es_nuevo: item.status === "NEW",
      aplicado: !!item.aplicar_stock && !!productoId,
    });
  }

  if (huboAplicacion) {
    await supabase.from("facturas").update({ estado: "aplicada", updated_at: new Date().toISOString() }).eq("id", factura.id);
  }

  return NextResponse.json({ ok: true, factura_id: factura.id, creados, alertas_costo: alertasCosto });
}
