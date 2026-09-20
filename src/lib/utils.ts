import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Escapa los comodines de LIKE/ILIKE (%, _, \) para que el texto del usuario
// (o de la IA) se trate como literal en las búsquedas de PostgREST.
export function escapeLike(termino: string): string {
  return termino.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Búsqueda por palabras sueltas: "tubo 2x1" debe encontrar "TUBO HP 2X1 6MTS"
// aunque las palabras no estén juntas. Devuelve un filtro `or` por palabra;
// encadenar varios .or() en PostgREST los combina con AND (todas deben estar).
export function filtrosBusqueda(termino: string): string[] {
  return termino
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[,()"]/g, ""))
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => {
      const like = escapeLike(t);
      return `nombre.ilike.%${like}%,sku.ilike.%${like}%,codigo_barras.ilike.%${like}%`;
    });
}

export function coincidePalabras(texto: string, termino: string): boolean {
  const t = texto.toLowerCase();
  return termino
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w));
}
