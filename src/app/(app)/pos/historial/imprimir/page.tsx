import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { getNegocioNombre } from "@/lib/negocio";
import { VistaCierre } from "@/components/pos/vista-cierre";
import { DEMO, demoCierreCaja, demoNegocioNombre } from "@/lib/demo";
import { ArrowLeft } from "lucide-react";
import type { CierreCaja } from "@/lib/types";

// Re-invoca cierre_caja() en vez de recibir estado del cliente: la RPC es
// de solo lectura/idempotente para "hoy", así que no hace falta pasar datos
// efímeros entre la pantalla de historial y esta vista imprimible.
export default async function ImprimirCierrePage() {
  const sesion = await getSesion();

  let cierre: CierreCaja;
  let negocioNombre: string;

  if (DEMO) {
    cierre = demoCierreCaja;
    negocioNombre = demoNegocioNombre;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.rpc("cierre_caja");
    cierre = data as CierreCaja;
    negocioNombre = await getNegocioNombre(sesion?.negocioId ?? null);
  }

  return (
    <div className="space-y-4 animate-in-up">
      <Link href="/pos/historial" className="inline-flex items-center text-sm text-muted-foreground print:hidden">
        <ArrowLeft className="mr-1 h-4 w-4" /> Historial
      </Link>
      <VistaCierre negocioNombre={negocioNombre} cierre={cierre} />
    </div>
  );
}
