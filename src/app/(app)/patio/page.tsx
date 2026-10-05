import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { cargarEntregas } from "@/lib/entregas";
import { puede } from "@/lib/permisos";
import { ListaEntregas } from "@/components/entregas/lista-entregas";
import { DEMO } from "@/lib/demo";
import type { MapaPermisos } from "@/lib/types";

export default async function PatioPage() {
  const sesion = await getSesion();
  if (!sesion?.negocioId) redirect("/");

  let permisos: MapaPermisos = { patio: "editar" };
  let entregas = [] as Awaited<ReturnType<typeof cargarEntregas>>;
  if (!DEMO) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("mis_permisos");
    permisos = ((data as { modulos?: MapaPermisos } | null)?.modulos ?? {}) as MapaPermisos;
    if (!puede(permisos, "patio", "ver")) redirect("/");
    entregas = await cargarEntregas(supabase, ["pendiente_patio", "incidencia", "listo"]);
  }

  return (
    <div className="space-y-4 animate-in-up">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Patio</h1>
        <p className="text-sm text-muted-foreground">
          Verifica los materiales de cada entrega antes de que salga. Si falta algo, márcala con incidencia.
        </p>
      </div>
      <ListaEntregas modo="patio" entregas={entregas} puedeEditar={puede(permisos, "patio", "editar")} />
    </div>
  );
}
