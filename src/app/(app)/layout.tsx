import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NavInferior } from "@/components/nav-inferior";
import { DEMO, demoKpis } from "@/lib/demo";
import type { MapaPermisos } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await getSesion();

  // El middleware ya redirige a /login si no hay sesión.
  if (!sesion) redirect("/login");
  // Con sesión pero sin negocio => primer uso.
  if (!sesion.negocioId) redirect("/onboarding");

  const esAdmin = sesion.rol === "ADMIN";

  let alertas = 0;
  let permisos: MapaPermisos = {};
  if (DEMO) {
    alertas = demoKpis.bajo_stock;
    permisos = { inventario: "editar", facturas: "editar", caja: "editar", finanzas: "editar", delivery: "editar", patio: "editar" };
  } else {
    const supabase = await createClient();
    const [kpis, mp] = await Promise.all([supabase.rpc("kpis_dashboard"), supabase.rpc("mis_permisos")]);
    alertas = (kpis.data as { bajo_stock?: number } | null)?.bajo_stock ?? 0;
    permisos = ((mp.data as { modulos?: MapaPermisos } | null)?.modulos ?? {}) as MapaPermisos;
  }

  return (
    <div className="min-h-dvh flex flex-col pb-20">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4">{children}</main>
      <NavInferior esAdmin={esAdmin} alertas={alertas} permisos={permisos} />
    </div>
  );
}
