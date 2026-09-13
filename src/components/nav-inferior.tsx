"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, ScanLine, FileSpreadsheet, ArrowLeftRight, Store, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemNav {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soloAdmin?: boolean;
}

const ITEMS: ItemNav[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/capturar", label: "Capturar", icon: ScanLine },
  { href: "/pos", label: "Caja", icon: Store },
  { href: "/movimientos", label: "Historial", icon: ArrowLeftRight },
  { href: "/reportes", label: "Reportes", icon: FileSpreadsheet, soloAdmin: true },
  { href: "/marketing", label: "Marketing", icon: Megaphone, soloAdmin: true },
];

export function NavInferior({ esAdmin, alertas = 0 }: { esAdmin: boolean; alertas?: number }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.soloAdmin || esAdmin);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 glass border-t">
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
                "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors press",
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
