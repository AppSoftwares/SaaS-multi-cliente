import { formatBs, formatFecha } from "@/lib/format";
import { TicketImpresion } from "@/components/pos/ticket-impresion";
import type { PedidoItem, PedidoPago } from "@/lib/types";

// Ticket de venta: solo bolívares, nunca la referencia USD interna
// (regulación cambiaria VE). Se usa tanto para pantalla como para impresión
// (ESC/POS o window.print vía #ticket-imprimible en globals.css).
export function VistaTicket({
  negocioNombre,
  numeroVenta,
  createdAt,
  items,
  pagos,
  subtotalBs,
  descuentoBs,
  totalBs,
  ivaBs,
  igtfBs,
  clienteCedula,
  clienteNombre,
  clienteApellido,
  clienteDireccion,
  clienteTelefono,
}: {
  negocioNombre: string;
  numeroVenta: number;
  createdAt: string;
  items: Pick<
    PedidoItem,
    "nombre" | "cantidad" | "precio_bs" | "subtotal_bs" | "descuento_monto_bs"
  >[];
  pagos: Pick<PedidoPago, "metodo" | "moneda" | "monto_moneda" | "monto_bs">[];
  subtotalBs?: number | null;
  descuentoBs?: number | null;
  totalBs: number;
  ivaBs?: number | null;
  igtfBs?: number | null;
  clienteCedula?: string | null;
  clienteNombre?: string | null;
  clienteApellido?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
}) {
  const nombreCompleto = [clienteNombre, clienteApellido].filter(Boolean).join(" ");
  const hayDescuento = !!descuentoBs && descuentoBs > 0;
  const hayIva = !!ivaBs && ivaBs > 0;
  const hayIgtf = !!igtfBs && igtfBs > 0;
  const lineas = construirLineas();

  function construirLineas(): string[] {
    const l: string[] = [negocioNombre, `Venta #${numeroVenta}`, formatFecha(createdAt)];
    if (nombreCompleto) l.push(`Cliente: ${nombreCompleto}`);
    if (clienteCedula) l.push(`Cédula: ${clienteCedula}`);
    if (clienteTelefono) l.push(`Tel: ${clienteTelefono}`);
    if (clienteDireccion) l.push(`Dir: ${clienteDireccion}`);
    l.push("--------------------------------");
    for (const it of items) {
      l.push(it.nombre);
      l.push(`  ${it.cantidad} x ${formatBs(it.precio_bs)} = ${formatBs(it.subtotal_bs)}`);
      if (it.descuento_monto_bs > 0) l.push(`  Descuento: -${formatBs(it.descuento_monto_bs)}`);
    }
    l.push("--------------------------------");
    if (hayDescuento && subtotalBs != null) {
      l.push(`Subtotal: ${formatBs(subtotalBs)}`);
      l.push(`Descuento: -${formatBs(descuentoBs)}`);
    }
    if (hayIva) l.push(`IVA: ${formatBs(ivaBs)}`);
    l.push(`TOTAL: ${formatBs(totalBs)}`);
    for (const p of pagos) {
      const monto = p.moneda === "USD" ? `$${p.monto_moneda.toFixed(2)}` : formatBs(p.monto_bs);
      l.push(`${p.metodo}: ${monto}`);
    }
    if (hayIgtf) l.push(`IGTF (divisas): ${formatBs(igtfBs)}`);
    l.push("Gracias por su compra");
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
        <p className="text-center text-xs">Venta #{numeroVenta}</p>
        <p className="text-center text-xs text-muted-foreground">{formatFecha(createdAt)}</p>
        {(nombreCompleto || clienteCedula || clienteTelefono || clienteDireccion) && (
          <div className="text-xs space-y-0.5">
            {nombreCompleto && <p>Cliente: {nombreCompleto}</p>}
            {clienteCedula && <p>Cédula: {clienteCedula}</p>}
            {clienteTelefono && <p>Tel: {clienteTelefono}</p>}
            {clienteDireccion && <p>Dir: {clienteDireccion}</p>}
          </div>
        )}
        <div className="border-t border-dashed border-border pt-2 space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="text-xs">
              <p>{it.nombre}</p>
              <div className="flex justify-between">
                <span>
                  {it.cantidad} x {formatBs(it.precio_bs)}
                </span>
                <span>{formatBs(it.subtotal_bs)}</span>
              </div>
              {it.descuento_monto_bs > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Descuento</span>
                  <span>-{formatBs(it.descuento_monto_bs)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-border pt-2 space-y-1">
          {hayDescuento && subtotalBs != null && (
            <>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatBs(subtotalBs)}</span>
              </div>
              <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                <span>Descuento</span>
                <span>-{formatBs(descuentoBs)}</span>
              </div>
            </>
          )}
          {hayIva && (
            <div className="flex justify-between text-xs">
              <span>IVA</span>
              <span>{formatBs(ivaBs)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>{formatBs(totalBs)}</span>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          {pagos.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{p.metodo}</span>
              <span>{p.moneda === "USD" ? `$${p.monto_moneda.toFixed(2)}` : formatBs(p.monto_bs)}</span>
            </div>
          ))}
        </div>
        {hayIgtf && (
          <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 border-t border-dashed border-border pt-1.5">
            <span>IGTF (pago en divisas)</span>
            <span>{formatBs(igtfBs)}</span>
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground pt-2">Gracias por su compra</p>
      </div>

      <TicketImpresion lineas={lineas} />
    </div>
  );
}
