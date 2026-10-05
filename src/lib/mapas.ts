// Enlaces de navegación para el repartidor. Con coordenadas (GPS del cliente)
// llevan al punto exacto; sin ellas, buscan la dirección escrita.

export function linkGoogleMaps(
  lat: number | null | undefined,
  lng: number | null | undefined,
  direccion: string | null | undefined
): string | null {
  if (lat != null && lng != null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (direccion?.trim()) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion.trim())}`;
  return null;
}

export function linkWaze(
  lat: number | null | undefined,
  lng: number | null | undefined,
  direccion: string | null | undefined
): string | null {
  if (lat != null && lng != null) return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  if (direccion?.trim()) return `https://waze.com/ul?q=${encodeURIComponent(direccion.trim())}&navigate=yes`;
  return null;
}

export function linkTelefono(telefono: string | null | undefined): string | null {
  const limpio = (telefono ?? "").replace(/[^\d+]/g, "");
  return limpio.length >= 7 ? `tel:${limpio}` : null;
}
