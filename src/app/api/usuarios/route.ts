import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion } from "@/lib/auth";
import type { Rol } from "@/lib/types";

export const runtime = "nodejs";

// Verifica que el que llama sea ADMIN y devuelve su negocio.
async function requireAdmin() {
  const sesion = await getSesion();
  if (!sesion) return { error: "No autenticado", status: 401 as const };
  if (sesion.rol !== "ADMIN" || !sesion.negocioId)
    return { error: "Solo ADMIN", status: 403 as const };
  return { sesion };
}

// GET: lista los usuarios del negocio (RLS con la sesión del ADMIN)
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles_usuario")
    .select("id, username, email, rol, created_at")
    .eq("negocio_id", guard.sesion!.negocioId)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ usuarios: data });
}

// POST: crea un usuario nuevo (auth + rol) en el negocio del ADMIN
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json();
  const email = (body.email ?? "").toString().trim().toLowerCase();
  const password = (body.password ?? "").toString();
  const username = (body.username ?? "").toString().trim() || email.split("@")[0];
  const rol: Rol = body.rol === "ADMIN" ? "ADMIN" : "ALMACEN";

  if (!email || password.length < 6) {
    return NextResponse.json(
      { error: "Correo válido y contraseña de al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: created, error: errCreate } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (errCreate || !created.user) {
    return NextResponse.json(
      { error: errCreate?.message ?? "No se pudo crear el usuario" },
      { status: 400 }
    );
  }

  const { error: errRol } = await admin.from("roles_usuario").insert({
    id: created.user.id,
    negocio_id: guard.sesion!.negocioId,
    rol,
    username,
    email,
  });
  if (errRol) {
    // Rollback del usuario auth si falla el rol
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: errRol.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: created.user.id });
}

// PATCH: cambia el rol o username de un usuario del negocio
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json();
  const id = (body.id ?? "").toString();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // No permitir que el ADMIN se quite a sí mismo el rol ADMIN
  if (id === guard.sesion!.userId && body.rol && body.rol !== "ADMIN") {
    return NextResponse.json({ error: "No puedes quitarte tu propio rol ADMIN" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.rol === "ADMIN" || body.rol === "ALMACEN") update.rol = body.rol;
  if (typeof body.username === "string") update.username = body.username.trim();
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("roles_usuario")
    .update(update)
    .eq("id", id)
    .eq("negocio_id", guard.sesion!.negocioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE: elimina un usuario (auth → cascada al rol). No puede eliminarse a sí mismo.
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  if (id === guard.sesion!.userId)
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });

  const admin = createAdminClient();
  // Verifica que el usuario pertenezca al negocio del ADMIN
  const { data: fila } = await admin
    .from("roles_usuario")
    .select("negocio_id")
    .eq("id", id)
    .maybeSingle();
  if (!fila || fila.negocio_id !== guard.sesion!.negocioId) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
