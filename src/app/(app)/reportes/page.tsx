import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { ReportesCliente } from "@/components/reportes-cliente";

export default async function ReportesPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "ADMIN") redirect("/");

  return (
    <div className="space-y-4 animate-in-up">
      <h1 className="text-2xl font-bold text-gradient">Reportes</h1>
      <p className="text-sm text-muted-foreground">
        Exporta a Excel para análisis o respaldo.
      </p>
      <ReportesCliente />
    </div>
  );
}
