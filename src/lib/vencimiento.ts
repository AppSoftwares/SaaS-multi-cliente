// Días de crédito y vencimiento de las facturas de proveedor. Las fechas son
// "YYYY-MM-DD" y se calculan en hora de Venezuela (UTC-4): con la hora del
// servidor (UTC) una factura aparecía como vencida horas antes de tiempo.

// Desde cuántos días antes se marca como "por vencer" (rojo).
export const DIAS_ALERTA_VENCIMIENTO = 3;

export function hoyVenezuela(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
}

function aUTC(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(aUTC(fecha) + dias * 86400000).toISOString().slice(0, 10);
}

// Días que faltan para la fecha (negativo = ya venció).
export function diasHasta(fecha: string, hoy: string = hoyVenezuela()): number {
  return Math.round((aUTC(fecha) - aUTC(hoy)) / 86400000);
}

export function formatoFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

export type NivelVencimiento = "sin" | "normal" | "atencion" | "urgente" | "vencida";

export interface EstadoVencimiento {
  nivel: NivelVencimiento;
  dias: number | null;
  texto: string;
}

// Solo tiene sentido para facturas pendientes de pago con fecha de vencimiento.
export function estadoVencimiento(
  factura: { pagada: boolean; fecha_vencimiento?: string | null },
  hoy: string = hoyVenezuela()
): EstadoVencimiento {
  if (factura.pagada || !factura.fecha_vencimiento) return { nivel: "sin", dias: null, texto: "" };
  const dias = diasHasta(factura.fecha_vencimiento, hoy);
  if (dias < 0) {
    return { nivel: "vencida", dias, texto: `Vencida hace ${-dias} día${dias === -1 ? "" : "s"}` };
  }
  if (dias === 0) return { nivel: "urgente", dias, texto: "Vence hoy" };
  if (dias <= DIAS_ALERTA_VENCIMIENTO) {
    return { nivel: "urgente", dias, texto: `Vence en ${dias} día${dias === 1 ? "" : "s"}` };
  }
  if (dias <= 7) return { nivel: "atencion", dias, texto: `Vence en ${dias} días` };
  return { nivel: "normal", dias, texto: `Vence el ${formatoFecha(factura.fecha_vencimiento)}` };
}

// Fecha de vencimiento = fecha de recepción + días de crédito (contado = sin plazo).
export function calcularVencimiento(fecha: string | null | undefined, dias: number | null | undefined): string | null {
  if (!fecha || dias == null || !(dias > 0)) return null;
  return sumarDias(fecha, Math.round(dias));
}
