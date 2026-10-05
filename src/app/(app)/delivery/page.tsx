import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { cargarEntregas } from "@/lib/entregas";
import { puede } from "@/lib/permisos";
import { ListaEntregas } from "@/components/entregas/lista-entregas";
import { DEMO } from "@/lib/demo";
import type { MapaPermisos } from "@/lib/types";

export default async function DeliveryPage() {
  const sesion = await getSesion();
  if (!sesion?.negocioId) redirect("/");

  let permisos: MapaPermisos = { delivery: "editar" };
  let entregas = [] as Awaited<ReturnType<typeof cargarEntregas>>;
  if (!DEMO) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("mis_permisos");
    permisos = ((data as { modulos?: MapaPermisos } | null)?.modulos ?? {}) as MapaPermisos;
    if (!puede(permisos, "delivery", "ver")) redirect("/");
    entregas = await cargarEntregas(supabase, ["listo", "en_ruta", "entregado", "incidencia"]);
  }

  return (
    <div className="space-y-4 animate-in-up">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Delivery</h1>
        <p className="text-sm text-muted-foreground">
          Entregas verificadas por patio. Sal a entregar y registra si se entregaron.
        </p>
      </div>
      <ListaEntregas modo="delivery" entregas={entregas} puedeEditar={puede(permisos, "delivery", "editar")} />
    </div>
  );
}
