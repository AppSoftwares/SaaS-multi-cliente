import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEMO } from "@/lib/demo";
import { ActualizarTasas } from "@/components/tasas/actualizar-tasas";
import type { TasasNegocio } from "@/lib/types";

export default async function TasasPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "ADMIN" || !sesion.negocioId) redirect("/");

  let tasas: TasasNegocio | null = null;
  if (DEMO) {
    tasas = { tasa_bcv: 639.7, tasa_binance: 737, tasa_actualizada_at: new Date().toISOString() };
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("negocios")
      .select("tasa_bcv, tasa_binance, tasa_actualizada_at")
      .eq("id", sesion.negocioId)
      .maybeSingle();
    tasas = (data as TasasNegocio) ?? null;
  }

  return (
    <div className="space-y-4 animate-in-up">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Precio en bolívares</h1>
        <p className="text-sm text-muted-foreground">
          Actualiza las tasas y recalcula los precios de todo el catálogo.
        </p>
      </div>
      <ActualizarTasas tasasActuales={tasas} />
    </div>
  );
}
