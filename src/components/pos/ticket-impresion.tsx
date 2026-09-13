"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { construirTicketEscPos, imprimirPorUsb, imprimirPorBluetooth } from "@/lib/ticket-escpos";

// Intenta imprimir en una impresora térmica por USB o Bluetooth (ESC/POS).
// Si no hay soporte o el usuario cancela, cae a la vista imprimible
// (window.print) ya estilizada a 80mm mediante @media print.
export function TicketImpresion({ lineas }: { lineas: string[] }) {
  const [imprimiendo, setImprimiendo] = useState(false);

  async function imprimir() {
    setImprimiendo(true);
    const data = construirTicketEscPos(lineas);
    const porUsb = await imprimirPorUsb(data);
    const ok = porUsb || (await imprimirPorBluetooth(data));
    setImprimiendo(false);
    if (!ok) window.print();
  }

  return (
    <Button onClick={imprimir} disabled={imprimiendo} className="w-full h-11 print:hidden">
      <Printer className="h-4 w-4" /> {imprimiendo ? "Imprimiendo…" : "Imprimir ticket"}
    </Button>
  );
}
