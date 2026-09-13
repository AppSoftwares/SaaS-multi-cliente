import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { FinanzasCliente } from "@/components/finanzas-cliente";

export default async function FinanzasPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "ADMIN") redirect("/");

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
