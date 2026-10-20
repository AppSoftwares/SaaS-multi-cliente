import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermisoFacturas } from "@/lib/facturas-auth";

export const runtime = "nodejs";

// Aplica los ítems pendientes (aplicado=false) de una factura al stock.
// Dos formas de entrada:
//   { token }        -> pública, sin sesión (portal del repartidor)
//   { factura_id }    -> autenticada, requiere ADMIN (panel)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token: string | undefined = body.token;
  const facturaId: string | undefined = body.factura_id;

  if (!token && !facturaId) {
    return NextResponse.json({ error: "Falta token o factura_id" }, { status: 400 });
  }

  if (token) {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("aplicar_entrega_factura", { p_token: token });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(data as object) });
  }

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

  const { data, error } = await supabase.rpc("aplicar_entrega_factura", { p_factura_id: facturaId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, ...(data as object) });
}
