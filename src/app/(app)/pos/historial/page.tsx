import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { HistorialCaja } from "@/components/pos/historial-caja";
import { DEMO, demoVentasPorFecha } from "@/lib/demo";
import { ArrowLeft } from "lucide-react";
import type { VentaDelDia } from "@/lib/types";

export default async function HistorialCajaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const sesion = await getSesion();
  const esAdmin = sesion?.rol === "ADMIN";
  const hoy = new Date().toISOString().slice(0, 10);
  const { fecha: fechaParam } = await searchParams;
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoy;

  let ventas: VentaDelDia[];

  if (DEMO) {
    ventas = demoVentasPorFecha(fecha);
  } else {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ventas_por_fecha", { p_fecha: fecha });
    ventas = (data ?? []) as VentaDelDia[];
  }

  return (
    <div className="space-y-4 animate-in-up">
      <Link href="/pos" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Caja
      </Link>
      <h1 className="text-2xl font-bold text-gradient">Cierre de caja</h1>
      <HistorialCaja ventas={ventas} esAdmin={esAdmin} fecha={fecha} hoy={hoy} />
    </div>
  );
}
