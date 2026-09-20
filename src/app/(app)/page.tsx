import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import type { KpisDashboard, Producto, TasasNegocio } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BotonSalir } from "@/components/boton-salir";
import { BotonTema } from "@/components/boton-tema";
import { Contador } from "@/components/contador";
import { DEMO, demoKpis, demoProductos } from "@/lib/demo";
import { ScanLine, FileSpreadsheet, AlertTriangle, Package, DollarSign, Coins, Users, FolderTree, Truck, Landmark, CreditCard } from "lucide-react";

export default async function DashboardPage() {
  const sesion = await getSesion();
  const esAdmin = sesion?.rol === "ADMIN";

  let kpis: KpisDashboard | null;
  let alertas: Pick<Producto, "id" | "nombre" | "cantidad" | "stock_minimo" | "unidad_medida">[];
  let tasas: TasasNegocio | null = null;

  if (DEMO) {
    kpis = demoKpis;
    alertas = demoProductos.filter((p) => p.stock_minimo > 0 && p.cantidad <= p.stock_minimo);
    tasas = { tasa_bcv: 639.7, tasa_binance: 737, tasa_actualizada_at: new Date().toISOString() };
  } else {
    const supabase = await createClient();
    const { data: kpisRaw } = await supabase.rpc("kpis_dashboard");
    kpis = kpisRaw as KpisDashboard | null;

    const { data: bajoStock } = await supabase
      .from("productos")
      .select("id, nombre, cantidad, stock_minimo, unidad_medida")
      .gt("stock_minimo", 0)
      .order("cantidad", { ascending: true })
      .limit(50);

    alertas = (bajoStock ?? []).filter(
      (p) => p.cantidad <= p.stock_minimo
    ) as Pick<Producto, "id" | "nombre" | "cantidad" | "stock_minimo" | "unidad_medida">[];

    if (sesion?.negocioId) {
      const { data: neg } = await supabase
        .from("negocios")
        .select("tasa_bcv, tasa_binance, tasa_actualizada_at")
        .eq("id", sesion.negocioId)
        .maybeSingle();
      tasas = (neg as TasasNegocio) ?? null;
    }
  }

  return (
    <div className="space-y-5 animate-in-up">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Joel Ferretería" className="h-12 w-auto max-w-[140px] object-contain shrink-0" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-brand-cyan/80">Panel</p>
              <p className="text-xs text-muted-foreground truncate">{sesion?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span title="Cambiar tema claro/oscuro">
              <BotonTema />
            </span>
            <span title="Cerrar sesión">
              <BotonSalir />
            </span>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Accesos">
          <Acceso href="/proveedores" label="Proveedores y facturas" icon={<Truck className="h-4 w-4" />} />
          {esAdmin && (
            <>
              <Acceso href="/finanzas" label="Finanzas" icon={<Landmark className="h-4 w-4" />} />
              <Acceso href="/creditos" label="Créditos a clientes" icon={<CreditCard className="h-4 w-4" />} />
              <Acceso
                href="/catalogos"
                label="Categorías, marcas y unidades"
                icon={<FolderTree className="h-4 w-4" />}
              />
              <Acceso href="/usuarios" label="Usuarios" icon={<Users className="h-4 w-4" />} />
            </>
          )}
        </nav>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={<Package className="h-4 w-4" />} label="Productos" value={kpis?.total_productos ?? 0} />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Bajo stock"
          value={kpis?.bajo_stock ?? 0}
          alerta={(kpis?.bajo_stock ?? 0) > 0}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Valor (venta)"
          value={kpis?.valor_inventario_venta ?? 0}
          moneda
        />
        {esAdmin && (
          <KpiCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Valor (costo)"
            value={kpis?.valor_inventario_costo ?? 0}
            moneda
          />
        )}
      </div>

      {/* Tasa vigente / precio en Bs */}
      {(tasas?.tasa_binance || esAdmin) && (
        <TasaCard tasas={tasas} esAdmin={esAdmin} />
      )}

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/capturar" className={buttonVariants({ size: "lg", className: "h-16 text-base" })}>
          <ScanLine className="mr-2 h-5 w-5" /> Capturar
        </Link>
        {esAdmin && (
          <Link
            href="/importar"
            className={buttonVariants({ variant: "secondary", size: "lg", className: "h-16 text-base" })}
          >
            <FileSpreadsheet className="mr-2 h-5 w-5" /> Importar Excel
          </Link>
        )}
      </div>

      {/* Alertas de reorden */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Reponer stock
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todo en orden. No hay productos bajo el mínimo.
            </p>
          ) : (
            <ul className="divide-y">
              {alertas.map((p, i) => (
                <li
                  key={p.id}
                  className="stagger-item flex items-center justify-between py-2"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <Link href={`/productos/${p.id}`} className="text-sm font-medium hover:underline">
                    {p.nombre}
                  </Link>
                  <Badge variant="destructive">
                    {p.cantidad} / {p.stock_minimo} {p.unidad_medida}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Acceso({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={buttonVariants({ variant: "outline", size: "sm", className: "h-9 gap-1.5 text-xs" })}
    >
      {icon}
      {label}
    </Link>
  );
}

function TasaCard({ tasas, esAdmin }: { tasas: TasasNegocio | null; esAdmin: boolean }) {
  const contenido = (
    <Card className="!border-primary/40">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-cyan text-white glow-cyan">
            <Coins className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Tasa vigente (Bs/USD)</p>
            <p className="font-bold">
              BCV {tasas?.tasa_bcv ?? "—"} · Binance {tasas?.tasa_binance ?? "—"}
            </p>
          </div>
        </div>
        {esAdmin && <span className="text-xs text-brand-cyan font-semibold">Actualizar →</span>}
      </CardContent>
    </Card>
  );
  return esAdmin ? (
    <Link href="/tasas" className="block press">
      {contenido}
    </Link>
  ) : (
    contenido
  );
}

function KpiCard({
  icon,
  label,
  value,
  moneda,
  alerta,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  moneda?: boolean;
  alerta?: boolean;
}) {
  return (
    <Card className={alerta ? "!border-destructive/50" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl ${
              alerta ? "bg-destructive/15 text-destructive" : "gradient-primary text-white glow-purple"
            }`}
          >
            {icon}
          </span>
          <span className="text-muted-foreground text-xs">{label}</span>
        </div>
        <Contador
          value={value}
          formato={moneda ? "usd" : "entero"}
          className={`text-xl font-bold ${alerta ? "text-destructive" : ""}`}
        />
      </CardContent>
    </Card>
  );
}
