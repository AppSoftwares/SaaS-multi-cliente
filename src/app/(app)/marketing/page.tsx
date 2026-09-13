import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { getNegocioNombre } from "@/lib/negocio";
import { DEMO, demoNegocioNombre } from "@/lib/demo";
import { MarketingCliente } from "@/components/marketing-cliente";

export default async function MarketingPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "ADMIN") redirect("/");

  const negocioNombre = DEMO ? demoNegocioNombre : await getNegocioNombre(sesion?.negocioId ?? null);

  return (
    <div className="space-y-4 animate-in-up">
      <h1 className="text-2xl font-bold text-gradient">Marketing</h1>
      <p className="text-sm text-muted-foreground">
        Analítica de clientes y campañas por WhatsApp.
      </p>
      <MarketingCliente negocioNombre={negocioNombre} />
    </div>
  );
}
