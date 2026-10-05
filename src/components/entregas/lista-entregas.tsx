"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, PackageCheck, Truck, AlertTriangle, MapPin, Navigation, Phone } from "lucide-react";
import { linkGoogleMaps, linkTelefono, linkWaze } from "@/lib/mapas";
import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import { formatBs } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EntregaPedido } from "@/lib/types";

const ESTADO_TEXTO: Record<EntregaPedido["estado"], string> = {
  pendiente_patio: "Pendiente de verificar en patio",
  listo: "Verificada, lista para salir",
  en_ruta: "En ruta",
  entregado: "Entregada",
  incidencia: "Con incidencia",
};

function BloqueNavegacion({ e }: { e: EntregaPedido }) {
  const p = e.pedido;
  if (!p) return null;
  const maps = linkGoogleMaps(p.lat, p.lng, p.direccion);
  const waze = linkWaze(p.lat, p.lng, p.direccion);
  const tel = linkTelefono(p.cliente_telefono);
  const conGps = p.lat != null && p.lng != null;
  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2 text-sm">
      <p className="font-medium break-words">{p.direccion || "Sin dirección escrita"}</p>
      {!conGps && (
        <p className="text-[11px] text-amber-600">Sin ubicación GPS: la navegación busca la dirección escrita.</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {maps ? (
          <a href={maps} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium hover:bg-muted/50">
            <MapPin className="h-3.5 w-3.5" /> Maps
          </a>
        ) : (
          <span />
        )}
        {waze ? (
          <a href={waze} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium hover:bg-muted/50">
            <Navigation className="h-3.5 w-3.5" /> Waze
          </a>
        ) : (
          <span />
        )}
        {tel ? (
          <a href={tel} className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium hover:bg-muted/50">
            <Phone className="h-3.5 w-3.5" /> Llamar
          </a>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function resumenPedido(e: EntregaPedido) {
  const items = e.pedido?.pedido_items ?? [];
  const unidades = items.reduce((s, it) => s + Number(it.cantidad || 0), 0);
  const hora = e.pedido?.created_at
    ? new Intl.DateTimeFormat("es-VE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Caracas" }).format(new Date(e.pedido.created_at))
    : "";
  return `${hora ? hora + " · " : ""}${items.length} producto${items.length === 1 ? "" : "s"} (${unidades} und.)`;
}

function nombreCliente(e: EntregaPedido) {
  const p = e.pedido;
  if (!p) return "Sin datos";
  return [p.cliente_nombre, p.cliente_apellido].filter(Boolean).join(" ") || "Cliente sin nombre";
}

// Patio: revisa los materiales de cada entrega contra la factura antes de que salga.
// Delivery: toma las entregas verificadas y registra si se entregaron.
export function ListaEntregas({
  modo,
  entregas,
  puedeEditar,
}: {
  modo: "patio" | "delivery";
  entregas: EntregaPedido[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nota, setNota] = useState<Record<string, string>>({});

  // Orden de trabajo: primero las más antiguas (salen antes).
  const porHora = (a: EntregaPedido, b: EntregaPedido) =>
    (a.pedido?.created_at ?? a.created_at).localeCompare(b.pedido?.created_at ?? b.created_at);
  const pendientes = (
    modo === "patio"
      ? entregas.filter((e) => e.estado === "pendiente_patio" || e.estado === "incidencia")
      : entregas.filter((e) => e.estado === "listo")
  ).sort(porHora);
  const enRuta = modo === "delivery" ? entregas.filter((e) => e.estado === "en_ruta").sort(porHora) : [];
  const cerradas = entregas.filter((e) => e.estado === "entregado" || (modo === "patio" && e.estado === "listo"));

  async function accion(id: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setOcupado(id);
    if (DEMO) {
      setOcupado(null);
      return toast.success(`(Demo) ${ok}`);
    }
    const { error } = await fn();
    setOcupado(null);
    if (error) return toast.error(error.message);
    toast.success(ok);
    router.refresh();
  }

  const supabase = () => createClient();

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {modo === "patio" ? "Por verificar" : "Listas para salir"} ({pendientes.length})
        </h2>
        {pendientes.length === 0 && <p className="text-sm text-muted-foreground">No hay entregas pendientes.</p>}
        {pendientes.map((e) => (
          <Card key={e.id} className={e.estado === "incidencia" ? "!border-amber-500/60" : undefined}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    Venta #{e.pedido?.numero_venta ?? "—"} · {nombreCliente(e)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.pedido?.cliente_telefono ? `Tel. ${e.pedido.cliente_telefono} · ` : ""}
                    {e.pedido?.direccion || "Sin dirección"}
                  </p>
                </div>
                <Badge variant={e.estado === "incidencia" ? "destructive" : "secondary"} className="shrink-0">
                  {ESTADO_TEXTO[e.estado]}
                </Badge>
              </div>

              {modo === "patio" && (
                <ul className="rounded-lg border border-border/50 divide-y divide-border/40 text-sm">
                  {(e.pedido?.pedido_items ?? []).map((it, i) => (
                    <li key={i} className="flex justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate">{it.nombre}</span>
                      <span className="shrink-0 font-semibold tabular-nums">× {it.cantidad}</span>
                    </li>
                  ))}
                  {(e.pedido?.pedido_items ?? []).length === 0 && (
                    <li className="px-3 py-2 text-muted-foreground">Sin productos registrados.</li>
                  )}
                </ul>
              )}

              <p className="text-xs text-muted-foreground">{resumenPedido(e)}</p>
              {e.nota && <p className="text-xs text-amber-600">Nota: {e.nota}</p>}

              {modo === "delivery" && <BloqueNavegacion e={e} />}

              {puedeEditar && modo === "patio" && (
                <div className="space-y-2">
                  <Input
                    placeholder="Nota (si hay faltantes o daños)"
                    value={nota[e.id] ?? ""}
                    onChange={(ev) => setNota((n) => ({ ...n, [e.id]: ev.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      disabled={ocupado === e.id}
                      onClick={() =>
                        accion(
                          e.id,
                          () => supabase().rpc("patio_verificar_entrega", { p_id: e.id, p_ok: false, p_nota: nota[e.id] || "Revisar en patio" }),
                          "Marcada con incidencia"
                        )
                      }
                    >
                      <AlertTriangle className="h-4 w-4" /> Hay faltantes
                    </Button>
                    <Button
                      disabled={ocupado === e.id}
                      onClick={() =>
                        accion(
                          e.id,
                          () => supabase().rpc("patio_verificar_entrega", { p_id: e.id, p_ok: true, p_nota: nota[e.id] || null }),
                          "Verificada. Lista para salir"
                        )
                      }
                    >
                      <ClipboardCheck className="h-4 w-4" /> Verificada
                    </Button>
                  </div>
                </div>
              )}

              {puedeEditar && modo === "delivery" && (
                <Button
                  className="w-full h-11"
                  disabled={ocupado === e.id}
                  onClick={() => accion(e.id, () => supabase().rpc("entrega_tomar", { p_id: e.id }), "En ruta")}
                >
                  <Truck className="h-4 w-4" /> Salgo a entregar
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {modo === "delivery" && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">En ruta ({enRuta.length})</h2>
          {enRuta.length === 0 && <p className="text-sm text-muted-foreground">Nada en ruta.</p>}
          {enRuta.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-semibold">
                    Venta #{e.pedido?.numero_venta ?? "—"} · {nombreCliente(e)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {resumenPedido(e)} · Delivery {formatBs(e.pedido?.costo_delivery ?? 0)}
                    {e.en_ruta_at ? ` · salió ${new Intl.DateTimeFormat("es-VE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Caracas" }).format(new Date(e.en_ruta_at))}` : ""}
                  </p>
                </div>
                <BloqueNavegacion e={e} />
                <Input
                  placeholder="Nota (opcional)"
                  value={nota[e.id] ?? ""}
                  onChange={(ev) => setNota((n) => ({ ...n, [e.id]: ev.target.value }))}
                />
                {puedeEditar && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      disabled={ocupado === e.id}
                      onClick={() =>
                        accion(
                          e.id,
                          () => supabase().rpc("entrega_cerrar", { p_id: e.id, p_entregado: false, p_nota: nota[e.id] || "No se pudo entregar" }),
                          "Marcada con incidencia"
                        )
                      }
                    >
                      <AlertTriangle className="h-4 w-4" /> No se pudo
                    </Button>
                    <Button
                      disabled={ocupado === e.id}
                      onClick={() =>
                        accion(
                          e.id,
                          () => supabase().rpc("entrega_cerrar", { p_id: e.id, p_entregado: true, p_nota: nota[e.id] || null }),
                          "Entregada"
                        )
                      }
                    >
                      <PackageCheck className="h-4 w-4" /> Entregada
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {modo === "patio" ? "Ya verificadas" : "Entregadas"} ({cerradas.length})
        </h2>
        {cerradas.slice(0, 20).map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              Venta #{e.pedido?.numero_venta ?? "—"} · {nombreCliente(e)}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {ESTADO_TEXTO[e.estado]}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
