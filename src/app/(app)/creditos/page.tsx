import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEMO, demoSaldosCreditos } from "@/lib/demo";
import { CreditosCliente } from "@/components/creditos-cliente";
import type { SaldoCreditoCliente } from "@/lib/types";

export default async function CreditosPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "ADMIN") redirect("/");

  let saldos: SaldoCreditoCliente[] = [];
  if (DEMO) {
    saldos = demoSaldosCreditos;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.rpc("saldo_creditos_clientes");
    saldos = (data ?? []) as SaldoCreditoCliente[];
  }

  return (
    <div className="space-y-4 animate-in-up">
      <h1 className="text-2xl font-bold text-gradient">Créditos a clientes</h1>
      <p className="text-sm text-muted-foreground">
        Saldo pendiente de clientes con ventas a crédito (fiado) y registro de abonos.
      </p>
      <CreditosCliente inicial={saldos} />
    </div>
  );
}
