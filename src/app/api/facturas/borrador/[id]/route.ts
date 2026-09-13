import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Trae una factura en borrador + sus ítems, para reabrirla en el wizard.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: rolRow } = await supabase
    .from("roles_usuario")
    .select("rol, negocio_id")
    .eq("id", user.id)
    .maybeSingle();
  if (rolRow?.rol !== "ADMIN" || !rolRow.negocio_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: factura } = await supabase
    .from("facturas")
    .select("*")
    .eq("id", id)
    .eq("negocio_id", rolRow.negocio_id)
    .eq("estado", "borrador")
    .maybeSingle();
  if (!factura) return NextResponse.json({ error: "Borrador no encontrado" }, { status: 404 });

  const { data: items } = await supabase
    .from("factura_items")
    .select("*")
    .eq("factura_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ factura, items: items ?? [] });
}

// Descarta un borrador (no aplica a facturas ya registradas/pagadas: solo
// mientras siguen en estado 'borrador').
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: rolRow } = await supabase
    .from("roles_usuario")
    .select("rol, negocio_id")
    .eq("id", user.id)
    .maybeSingle();
  if (rolRow?.rol !== "ADMIN" || !rolRow.negocio_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { error } = await supabase
    .from("facturas")
    .delete()
    .eq("id", id)
    .eq("negocio_id", rolRow.negocio_id)
    .eq("estado", "borrador");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
