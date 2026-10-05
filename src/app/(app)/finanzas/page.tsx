import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEMO } from "@/lib/demo";
import { puede } from "@/lib/permisos";
import { FinanzasCliente } from "@/components/finanzas-cliente";
import type { MapaPermisos } from "@/lib/types";

export default async function FinanzasPage() {
  const sesion = await getSesion();
  if (!sesion?.negocioId) redirect("/");
  if (!DEMO) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("mis_permisos");
    const permisos = ((data as { modulos?: MapaPermisos } | null)?.modulos ?? {}) as MapaPermisos;
    if (!puede(permisos, "finanzas", "ver")) redirect("/");
  }

  return (
    <div className="space-y-4 animate-in-up">
      <h1 className="text-2xl font-bold text-gradient">Finanzas</h1>
      <p className="text-sm text-muted-foreground">
        Ventas vs. pagos a proveedores por rango de fecha.
      </p>
      <FinanzasCliente />
    </div>
  );
}
