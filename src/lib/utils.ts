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
