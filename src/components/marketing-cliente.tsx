"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO, demoClientesAnalytics, demoCampanas } from "@/lib/demo";
import { formatBs, formatFecha } from "@/lib/format";
import { linkWhatsApp } from "@/lib/whatsapp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, TrendingUp, ShoppingCart, UserPlus, Star, AlertTriangle, Sparkles, Send, Megaphone } from "lucide-react";
import { toast } from "sonner";
import type {
  ClientesAnalytics,
  ClienteMarketing,
  TipoCampana,
  SegmentoCampana,
  Campana,
  DestinatarioCampana,
  ResultadoCrearCampana,
} from "@/lib/types";

// Plantillas de mensaje por tipo de campaña (buenas prácticas de retail: cercanas,
// personalizadas con {nombre}, con una razón clara para volver a la tienda).
const PLANTILLAS: Record<TipoCampana, { label: string; mensaje: (negocio: string) => string }> = {
  reactivacion: {
    label: "Reactivación (clientes en riesgo)",
    mensaje: (n) =>
      `Hola {nombre}, te extrañamos en ${n}. Hace tiempo no te vemos por aquí, vuelve pronto: tenemos algo especial para ti.`,
  },
  promocion: {
    label: "Promoción / oferta",
    mensaje: (n) => `Hola {nombre}, en ${n} tenemos ofertas especiales esta semana. ¡No te las pierdas!`,
  },
  fidelizacion: {
    label: "Fidelización (clientes frecuentes)",
    mensaje: (n) =>
      `Hola {nombre}, gracias por tu preferencia en ${n}. Como cliente frecuente queremos premiarte, pásate por la tienda.`,
  },
  bienvenida: {
    label: "Bienvenida (clientes nuevos)",
    mensaje: (n) => `Hola {nombre}, ¡bienvenido/a a ${n}! Gracias por tu compra, cualquier consulta estamos a la orden.`,
  },
  anuncio: {
    label: "Anuncio / novedad",
    mensaje: (n) => `Hola {nombre}, te contamos las novedades de ${n}. ¡Pásate a conocerlas!`,
  },
};

const TIPOS: TipoCampana[] = ["reactivacion", "promocion", "fidelizacion", "bienvenida", "anuncio"];

export function MarketingCliente({ negocioNombre }: { negocioNombre: string }) {
  const supabase = createClient();
  const [analytics, setAnalytics] = useState<ClientesAnalytics | null>(null);
  const [cargando, setCargando] = useState(true);
  const [campanas, setCampanas] = useState<Campana[]>([]);

  const [seleccionados, setSeleccionados] = useState<Map<string, ClienteMarketing>>(new Map());
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [segmentoDialogo, setSegmentoDialogo] = useState<SegmentoCampana>("manual");
  const [tipo, setTipo] = useState<TipoCampana>("promocion");
  const [nombreCampana, setNombreCampana] = useState("");
  const [mensaje, setMensaje] = useState(PLANTILLAS.promocion.mensaje(negocioNombre));
  const [guardando, setGuardando] = useState(false);
  const [campanaEnviar, setCampanaEnviar] = useState<{ campana: Campana; destinatarios: DestinatarioCampana[] } | null>(
    null
  );

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar() {
    setCargando(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 250));
      setAnalytics(demoClientesAnalytics);
      setCampanas(demoCampanas);
      setCargando(false);
      return;
    }
    const [{ data: dAnalytics, error: eAnalytics }, { data: dCampanas, error: eCampanas }] = await Promise.all([
      supabase.rpc("clientes_analytics"),
      supabase.rpc("listar_campanas"),
    ]);
    setCargando(false);
    if (eAnalytics) return toast.error(eAnalytics.message);
    if (eCampanas) return toast.error(eCampanas.message);
    setAnalytics(dAnalytics as ClientesAnalytics);
    setCampanas((dCampanas as Campana[]) ?? []);
  }

  function toggleSeleccion(c: ClienteMarketing) {
    setSeleccionados((prev) => {
      const next = new Map(prev);
      if (next.has(c.cliente_id)) next.delete(c.cliente_id);
      else next.set(c.cliente_id, c);
      return next;
    });
  }

  function tipoSugerido(segmento: SegmentoCampana): TipoCampana {
    if (segmento === "riesgo") return "reactivacion";
    if (segmento === "nuevos") return "bienvenida";
    if (segmento === "frecuentes") return "fidelizacion";
    return "promocion";
  }

  function abrirDialogoConSegmento(segmento: SegmentoCampana, clientes: ClienteMarketing[]) {
    const mapa = new Map<string, ClienteMarketing>();
    clientes.forEach((c) => mapa.set(c.cliente_id, c));
    setSeleccionados(mapa);
    setSegmentoDialogo(segmento);
    const t = tipoSugerido(segmento);
    setTipo(t);
    setMensaje(PLANTILLAS[t].mensaje(negocioNombre));
    setNombreCampana("");
    setDialogAbierto(true);
  }

  function abrirDialogoManual() {
    setSegmentoDialogo("manual");
    setTipo("promocion");
    setMensaje(PLANTILLAS.promocion.mensaje(negocioNombre));
    setNombreCampana("");
    setDialogAbierto(true);
  }

  function cambiarTipo(t: TipoCampana) {
    setTipo(t);
    setMensaje(PLANTILLAS[t].mensaje(negocioNombre));
  }

  async function crearCampana() {
    if (seleccionados.size === 0) return toast.error("Selecciona al menos un cliente");
    if (!nombreCampana.trim()) return toast.error("Ponle un nombre a la campaña");
    if (!mensaje.trim()) return toast.error("Escribe el mensaje");

    setGuardando(true);
    const clientesSel = Array.from(seleccionados.values());

    if (DEMO) {
      await new Promise((r) => setTimeout(r, 300));
      const nueva: Campana = {
        id: crypto.randomUUID(),
        nombre: nombreCampana,
        tipo,
        mensaje,
        segmento: segmentoDialogo,
        estado: "borrador",
        created_at: new Date().toISOString(),
        enviada_at: null,
        destinatarios: clientesSel.length,
        enviados: 0,
      };
      setCampanas((cs) => [nueva, ...cs]);
      setGuardando(false);
      setDialogAbierto(false);
      setCampanaEnviar({
        campana: nueva,
        destinatarios: clientesSel.map((c) => ({
          cliente_id: c.cliente_id,
          nombre: c.nombre,
          apellido: c.apellido,
          telefono: c.telefono,
        })),
      });
      return toast.success("(Demo) Campaña creada");
    }

    const { data, error } = await supabase.rpc("crear_campana", {
      p_nombre: nombreCampana,
      p_tipo: tipo,
      p_mensaje: mensaje,
      p_segmento: segmentoDialogo,
      p_cliente_ids: clientesSel.map((c) => c.cliente_id),
    });
    setGuardando(false);
    if (error) return toast.error(error.message);

    const res = data as ResultadoCrearCampana;
    const nueva: Campana = {
      id: res.campana_id,
      nombre: nombreCampana,
      tipo,
      mensaje,
      segmento: segmentoDialogo,
      estado: "borrador",
      created_at: new Date().toISOString(),
      enviada_at: null,
      destinatarios: res.destinatarios.length,
      enviados: 0,
    };
    setCampanas((cs) => [nueva, ...cs]);
    setDialogAbierto(false);
    setCampanaEnviar({ campana: nueva, destinatarios: res.destinatarios });
    toast.success("Campaña creada");
  }

  async function marcarEnviada(id: string) {
    if (DEMO) {
      setCampanas((cs) =>
        cs.map((c) => (c.id === id ? { ...c, estado: "enviada", enviada_at: new Date().toISOString(), enviados: c.destinatarios } : c))
      );
      setCampanaEnviar(null);
      return toast.success("(Demo) Campaña marcada como enviada");
    }
    const { error } = await supabase.rpc("marcar_campana_enviada", { p_campana_id: id });
    if (error) return toast.error(error.message);
    setCampanas((cs) =>
      cs.map((c) => (c.id === id ? { ...c, estado: "enviada", enviada_at: new Date().toISOString(), enviados: c.destinatarios } : c))
    );
    setCampanaEnviar(null);
    toast.success("Campaña marcada como enviada");
  }

  if (cargando) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!analytics) {
    return <p className="text-sm text-muted-foreground">No hay datos de clientes todavía.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-brand-cyan" />
              <p className="text-xs text-muted-foreground">Ticket promedio</p>
            </div>
            <p className="font-bold">{formatBs(analytics.ticket_promedio_general_bs)}</p>
            <p className="text-[11px] text-muted-foreground">Mes: {formatBs(analytics.ticket_promedio_mes_bs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-brand-purple" />
              <p className="text-xs text-muted-foreground">Compras</p>
            </div>
            <p className="font-bold">{analytics.compras_total}</p>
            <p className="text-[11px] text-muted-foreground">Último mes: {analytics.compras_mes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-brand-green" />
              <p className="text-xs text-muted-foreground">Activos (mes)</p>
            </div>
            <p className="font-bold">{analytics.clientes_activos_mes}</p>
            <p className="text-[11px] text-muted-foreground">Total: {analytics.total_clientes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-brand-amber" />
              <p className="text-xs text-muted-foreground">Nuevos (mes)</p>
            </div>
            <p className="font-bold">{analytics.clientes_nuevos_mes}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-brand-amber" /> Clientes más frecuentes
          </CardTitle>
          {analytics.top_clientes.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => abrirDialogoConSegmento("frecuentes", analytics.top_clientes)}>
              <Megaphone className="h-3.5 w-3.5 mr-1" /> Campaña
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ListaClientes
            clientes={analytics.top_clientes}
            seleccionados={seleccionados}
            onToggle={toggleSeleccion}
            vacio="Aún no hay clientes con compras registradas."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Clientes en riesgo de fuga
          </CardTitle>
          {analytics.clientes_riesgo.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => abrirDialogoConSegmento("riesgo", analytics.clientes_riesgo)}>
              <Megaphone className="h-3.5 w-3.5 mr-1" /> Campaña
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ListaClientes
            clientes={analytics.clientes_riesgo}
            seleccionados={seleccionados}
            onToggle={toggleSeleccion}
            vacio="Sin clientes en riesgo por ahora."
            mostrarInactividad
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-brand-cyan" /> Clientes nuevos
          </CardTitle>
          {analytics.clientes_nuevos.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => abrirDialogoConSegmento("nuevos", analytics.clientes_nuevos)}>
              <Megaphone className="h-3.5 w-3.5 mr-1" /> Campaña
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ListaClientes
            clientes={analytics.clientes_nuevos}
            seleccionados={seleccionados}
            onToggle={toggleSeleccion}
            vacio="Sin clientes nuevos en los últimos 30 días."
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-xl border p-3">
        <p className="text-sm text-muted-foreground">
          {seleccionados.size > 0 ? `${seleccionados.size} cliente(s) seleccionados` : "Selecciona clientes de las listas de arriba"}
        </p>
        <Button size="sm" onClick={abrirDialogoManual} disabled={seleccionados.size === 0}>
          <Sparkles className="h-3.5 w-3.5 mr-1" /> Crear campaña
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-brand-purple" /> Campañas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campanas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Aún no has creado campañas.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {campanas.map((c) => (
                <li key={c.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {PLANTILLAS[c.tipo]?.label ?? c.tipo} · {c.destinatarios} destinatario(s) · {formatFecha(c.created_at)}
                    </p>
                  </div>
                  <Badge variant={c.estado === "enviada" ? "default" : "outline"}>
                    {c.estado === "enviada" ? "Enviada" : "Borrador"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva campaña</DialogTitle>
            <DialogDescription>{seleccionados.size} cliente(s) seleccionados</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre de la campaña</Label>
              <Input
                value={nombreCampana}
                onChange={(e) => setNombreCampana(e.target.value)}
                placeholder="Ej. Reactivación de septiembre"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => v && cambiarTipo(v as TipoCampana)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PLANTILLAS[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Mensaje ({"{nombre}"} se reemplaza por el nombre del cliente)</Label>
              <Textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={crearCampana} disabled={guardando}>
              {guardando ? "Creando…" : "Crear campaña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!campanaEnviar} onOpenChange={(o) => !o && setCampanaEnviar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar campaña</DialogTitle>
            <DialogDescription>Abre cada enlace de WhatsApp para enviar el mensaje personalizado a cada cliente.</DialogDescription>
          </DialogHeader>
          {campanaEnviar && (
            <ul className="max-h-64 overflow-y-auto space-y-1.5">
              {campanaEnviar.destinatarios.map((d) => {
                const nombre = [d.nombre, d.apellido].filter(Boolean).join(" ") || "Cliente";
                const texto = campanaEnviar.campana.mensaje.replaceAll("{nombre}", d.nombre || "");
                return (
                  <li key={d.cliente_id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                    <span className="text-sm truncate">{nombre}</span>
                    <a href={linkWhatsApp(texto, d.telefono)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        <Send className="h-3.5 w-3.5 mr-1" /> Enviar
                      </Button>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampanaEnviar(null)}>
              Cerrar
            </Button>
            {campanaEnviar && campanaEnviar.campana.estado !== "enviada" && (
              <Button onClick={() => marcarEnviada(campanaEnviar.campana.id)}>Marcar como enviada</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListaClientes({
  clientes,
  seleccionados,
  onToggle,
  vacio,
  mostrarInactividad = false,
}: {
  clientes: ClienteMarketing[];
  seleccionados: Map<string, ClienteMarketing>;
  onToggle: (c: ClienteMarketing) => void;
  vacio: string;
  mostrarInactividad?: boolean;
}) {
  if (clientes.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">{vacio}</p>;
  }
  return (
    <ul className="divide-y divide-border/40">
      {clientes.map((c) => {
        const nombre = [c.nombre, c.apellido].filter(Boolean).join(" ") || c.cedula;
        const checked = seleccionados.has(c.cliente_id);
        return (
          <li key={c.cliente_id} className="p-3 flex items-center gap-3">
            <Checkbox checked={checked} onCheckedChange={() => onToggle(c)} />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{nombre}</p>
              <p className="text-xs text-muted-foreground truncate">
                {c.cedula}
                {c.compras != null && ` · ${c.compras} compra(s)`}
                {c.total_gastado_bs != null && ` · ${formatBs(c.total_gastado_bs)}`}
                {mostrarInactividad && c.ultima_compra && ` · última: ${formatFecha(c.ultima_compra)}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
