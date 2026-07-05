import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { ImportarCliente } from "@/components/importar/importar-cliente";

export default async function ImportarPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "ADMIN" || !sesion.negocioId) redirect("/");

  return (
    <div className="space-y-4 animate-in-up">
      <h1 className="text-2xl font-bold text-gradient">Importar desde Excel</h1>
      <p className="text-sm text-muted-foreground">
        Sube el Excel de ventas de tu software de facturación para actualizar el stock.
      </p>
      <ImportarCliente negocioId={sesion.negocioId} />
    </div>
  );
}
