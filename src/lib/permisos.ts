import type { MapaPermisos, ModuloPermiso, NivelPermiso, Rol } from "@/lib/types";

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: "Gerente general",
  ALMACEN: "Almacén (anterior)",
  GERENTE_OPERATIVO: "Gerente operativo",
  FACTURACION: "Facturación y compra",
  LIDER_CAJA: "Líder de caja",
  VENDEDOR: "Vendedor",
  LIDER_PATIO: "Líder de patio",
  DELIVERY: "Delivery",
};

// Roles que se pueden asignar desde Usuarios (ALMACEN queda solo por compatibilidad).
export const ROLES_ASIGNABLES: Rol[] = [
  "ADMIN",
  "GERENTE_OPERATIVO",
  "FACTURACION",
  "LIDER_CAJA",
  "VENDEDOR",
  "LIDER_PATIO",
  "DELIVERY",
];

// La UI solo oculta; la seguridad real está en la base (RLS y funciones).
export function puede(permisos: MapaPermisos, modulo: ModuloPermiso, nivel: NivelPermiso = "ver"): boolean {
  const actual = permisos[modulo];
  if (!actual) return false;
  return nivel === "ver" || actual === "editar";
}
