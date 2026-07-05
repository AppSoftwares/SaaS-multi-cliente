import { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/lib/types";

export interface SesionUsuario {
  userId: string;
  email: string | null;
  negocioId: string | null;
  rol: Rol | null;
}

// Devuelve la sesión + rol/negocio del usuario, o null si no hay sesión.
export async function getSesion(): Promise<SesionUsuario | null> {
  // Modo demo: sesión ADMIN de ejemplo, sin base de datos.
  const { DEMO, demoSesion } = await import("@/lib/demo");
  if (DEMO) return demoSesion;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rolRow } = await supabase
    .from("roles_usuario")
    .select("rol, negocio_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    negocioId: rolRow?.negocio_id ?? null,
    rol: (rolRow?.rol as Rol) ?? null,
  };
}

export function esAdmin(sesion: SesionUsuario | null): boolean {
  return sesion?.rol === "ADMIN";
}
