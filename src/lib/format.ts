// Utilidades de formato (moneda USD y fechas en español).

export function formatUSD(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
  }).format(valor);
}

export function formatBs(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return `${new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)} Bs`;
}

export function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
