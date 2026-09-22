import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { GestionUsuarios } from "@/components/usuarios/gestion-usuarios";
import { ConfigClaveDescuentos } from "@/components/usuarios/config-clave-descuentos";
import { ConfigClaveEliminacion } from "@/components/usuarios/config-clave-eliminacion";

export default async function UsuariosPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "ADMIN") redirect("/");

  return (
    <div className="space-y-4 animate-in-up">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Usuarios y roles</h1>
        <p className="text-sm text-muted-foreground">
          Administra quién accede y con qué permisos.
        </p>
      </div>
      <GestionUsuarios miId={sesion.userId} />
      <ConfigClaveDescuentos />
      <ConfigClaveEliminacion />
    </div>
  );
}
