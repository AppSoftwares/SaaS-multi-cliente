"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO } from "@/lib/demo";
import { toast } from "sonner";
import { CheckCircle2, PackageCheck } from "lucide-react";

export function ConfirmarEntrega({ token, yaEntregado }: { token: string; yaEntregado: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(yaEntregado);

  async function confirmar() {
    setConfirmando(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 400));
      setConfirmando(false);
      setConfirmado(true);
      return toast.success("(Demo) Entrega confirmada");
    }
    const res = await fetch("/api/facturas/aplicar-pendientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    setConfirmando(false);
    if (!res.ok) return toast.error(data.error ?? "No se pudo confirmar la entrega");
    setConfirmado(true);
    toast.success("Entrega confirmada, stock actualizado");
  }

  if (confirmado) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Entrega confirmada</p>
        <p className="text-sm text-muted-foreground">El stock del inventario ya fue actualizado.</p>
      </div>
    );
  }

  return (
    <Button onClick={confirmar} disabled={confirmando} className="w-full h-12">
      <PackageCheck className="h-4 w-4" /> {confirmando ? "Confirmando…" : "Confirmar recepción"}
    </Button>
  );
}
