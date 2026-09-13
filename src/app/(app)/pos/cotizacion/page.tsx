import { getSesion } from "@/lib/auth";
import { getNegocioNombre } from "@/lib/negocio";
import { CotizacionCliente } from "@/components/pos/cotizacion-cliente";
import { DEMO } from "@/lib/demo";

export default async function CotizacionPage() {
  const sesion = await getSesion();
  const negocioNombre = DEMO ? "Mi Ferretería" : await getNegocioNombre(sesion?.negocioId ?? null);

  return <CotizacionCliente negocioNombre={negocioNombre} />;
}
