"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, ScanLine, FileSpreadsheet, ArrowLeftRight, Store, Megaphone, Truck, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { puede } from "@/lib/permisos";
import type { MapaPermisos } from "@/lib/types";

interface ItemNav {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: (esAdmin: boolean, permisos: MapaPermisos) => boolean;
}

const ITEMS: ItemNav[] = [
  { href: "/", label: "Inicio", icon: Home, visible: () => true },
  { href: "/productos", label: "Productos", icon: Package, visible: (_, p) => puede(p, "inventario", "ver") },
  { href: "/capturar", label: "Capturar", icon: ScanLine, visible: (_, p) => puede(p, "inventario", "editar") || puede(p, "facturas", "editar") },
  { href: "/pos", label: "Caja", icon: Store, visible: (_, p) => puede(p, "caja", "ver") },
  { href: "/patio", label: "Patio", icon: ClipboardCheck, visible: (_, p) => puede(p, "patio", "ver") },
  { href: "/delivery", label: "Delivery", icon: Truck, visible: (_, p) => puede(p, "delivery", "ver") },
  { href: "/movimientos", label: "Historial", icon: ArrowLeftRight, visible: (_, p) => puede(p, "inventario", "ver") || puede(p, "caja", "ver") },
  { href: "/reportes", label: "Reportes", icon: FileSpreadsheet, visible: (esAdmin) => esAdmin },
  { href: "/marketing", label: "Marketing", icon: Megaphone, visible: (esAdmin) => esAdmin },
];

export function NavInferior({
  esAdmin,
  alertas = 0,
  permisos = {},
}: {
  esAdmin: boolean;
  alertas?: number;
  permisos?: MapaPermisos;
}) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.visible(esAdmin, permisos));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 glass border-t pb-[env(safe-area-inset-bottom)]">
      <div
        className="max-w-2xl mx-auto grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map(({ href, label, icon: Icon }) => {
          const activo = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const destacado = href === "/capturar";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors press",
                activo && !destacado
                  ? "text-primary [text-shadow:0_0_12px_rgba(180,79,255,0.7)]"
                  : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "relative flex items-center justify-center rounded-2xl transition-all",
                  destacado
                    ? "h-12 w-12 -mt-5 gradient-primary text-white glow-pulse ring-4 ring-background"
                    : "h-6 w-6"
                )}
              >
                <Icon className="h-5 w-5" />
                {href === "/" && alertas > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                    {alertas > 9 ? "9+" : alertas}
                  </span>
                )}
              </span>
              <span className={destacado ? "font-semibold text-primary" : undefined}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
