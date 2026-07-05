// Rate-limit simple en memoria (por instancia). Suficiente como primera barrera
// contra abuso del endpoint de IA. Para producción a escala, usar Upstash/Redis.
const ventana = 60_000; // 1 minuto
const maxPorVentana = 20;
const registros = new Map<string, number[]>();

export function permitido(clave: string): boolean {
  const ahora = Date.now();
  const previos = (registros.get(clave) ?? []).filter((t) => ahora - t < ventana);
  if (previos.length >= maxPorVentana) {
    registros.set(clave, previos);
    return false;
  }
  previos.push(ahora);
  registros.set(clave, previos);
  return true;
}
