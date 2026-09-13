import { formatBs } from "@/lib/format";
import { TicketImpresion } from "@/components/pos/ticket-impresion";
import type { CierreCaja } from "@/lib/types";

// Comprobante de cierre de caja (80mm), mismo patrón visual que VistaTicket.
export function VistaCierre({
  negocioNombre,
  cierre,
}: {
  negocioNombre: string;
  cierre: CierreCaja;
}) {
  const metodos = Object.entries(cierre.por_metodo);
  const lineas = construirLineas();

  function construirLineas(): string[] {
    const l: string[] = [negocioNombre, `Cierre de caja — ${cierre.fecha}`, "--------------------------------"];
    for (const [metodo, monto] of metodos) l.push(`${metodo}: ${formatBs(monto)}`);
    l.push("--------------------------------");
    l.push(`Ventas: ${cierre.ventas}`);
    l.push(`TOTAL: ${formatBs(cierre.total_bs)}`);
    if (cierre.pendiente_por_cobrar_bs > 0) {
      l.push(`Pend. por cobrar (créditos): ${formatBs(cierre.pendiente_por_cobrar_bs)}`);
    }
    return l;
  }

  return (
    <div className="space-y-4">
      <div
        id="ticket-imprimible"
        className="glass rounded-2xl p-4 font-mono text-sm space-y-2 max-w-xs mx-auto"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpeg" alt="" className="mx-auto h-10 w-auto object-contain" />
        <p className="text-center font-bold">{negocioNombre}</p>
        <p className="text-center text-xs">Cierre de caja</p>
        <p className="text-center text-xs text-muted-foreground">{cierre.fecha}</p>
        <div className="border-t border-dashed border-border pt-2 space-y-1">
          {metodos.map(([metodo, monto]) => (
            <div key={metodo} className="flex justify-between text-xs">
              <span>{metodo}</span>
              <span>{formatBs(monto)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-border pt-2 flex justify-between text-xs">
          <span>Ventas</span>
          <span>{cierre.ventas}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{formatBs(cierre.total_bs)}</span>
        </div>
        {cierre.pendiente_por_cobrar_bs > 0 && (
          <div className="border-t border-dashed border-border pt-2 flex justify-between text-xs">
            <span>Créditos pendientes</span>
            <span>{formatBs(cierre.pendiente_por_cobrar_bs)}</span>
          </div>
        )}
      </div>

      <TicketImpresion lineas={lineas} />
    </div>
  );
}
