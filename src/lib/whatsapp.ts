// Construye enlaces wa.me. Sin teléfono, abre el selector de contactos de WhatsApp.
export function normalizarTelefonoVE(telefono: string): string {
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("0")) digitos = "58" + digitos.slice(1);
  else if (!digitos.startsWith("58")) digitos = "58" + digitos;
  return digitos;
}

export function linkWhatsApp(mensaje: string, telefono?: string | null): string {
  const texto = encodeURIComponent(mensaje);
  if (telefono && telefono.trim()) {
    return `https://wa.me/${normalizarTelefonoVE(telefono)}?text=${texto}`;
  }
  return `https://wa.me/?text=${texto}`;
}
