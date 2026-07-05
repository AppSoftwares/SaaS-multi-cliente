"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parsearExcel, type FilaExcel } from "@/lib/importar-excel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DEMO, demoProductos } from "@/lib/demo";
import { Upload, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";

type Modo = "VENDIDO" | "STOCK_FINAL";
type Estado = "OK" | "FALTA_DATO" | "NUEVO";

interface FilaClasificada extends FilaExcel {
  estado: Estado;
  motivo?: string;
  productoId?: string;
  productoNombre?: string;
  stockActual?: number;
  añadir?: boolean; // decisión del admin para filas NUEVO
}

function norm(s: string | null): string {
  return (s ?? "").toString().trim().toLowerCase();
}

export function ImportarCliente({ negocioId }: { negocioId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [modo, setModo] = useState<Modo>("VENDIDO");
  const [fase, setFase] = useState<"subir" | "preview" | "aplicando" | "hecho">("subir");
  const [filas, setFilas] = useState<FilaClasificada[]>([]);
  const [resumen, setResumen] = useState<{ aplicados: number; creados: number; omitidos: number } | null>(null);

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    let parsed;
    try {
      parsed = await parsearExcel(file);
    } catch {
      return toast.error("No se pudo leer el Excel");
    }
    if (parsed.filas.length === 0) return toast.error("El Excel está vacío");
    if (!parsed.mapeo.cantidad || (!parsed.mapeo.sku && !parsed.mapeo.codigo_barras)) {
      toast.error("No se detectó columna de cantidad ni de SKU/código. Revisa los encabezados.");
    }

    // Cargar catálogo para hacer match en memoria
    type ProdMatch = {
      id: string;
      nombre: string;
      sku: string | null;
      codigo_barras: string | null;
      cantidad: number;
    };
    const { data: prods } = DEMO
      ? { data: demoProductos as ProdMatch[] }
      : await supabase
          .from("productos")
          .select("id, nombre, sku, codigo_barras, cantidad")
          .returns<ProdMatch[]>();
    const porSku = new Map<string, ProdMatch>();
    const porCod = new Map<string, ProdMatch>();
    (prods ?? []).forEach((p) => {
      if (p.sku) porSku.set(norm(p.sku), p);
      if (p.codigo_barras) porCod.set(norm(p.codigo_barras), p);
    });

    const clasificadas: FilaClasificada[] = parsed.filas.map((f) => {
      if (!f.sku && !f.codigo_barras) {
        return { ...f, estado: "FALTA_DATO", motivo: "Sin SKU ni código de barras" };
      }
      if (!f.cantidadValida) {
        return { ...f, estado: "FALTA_DATO", motivo: "Cantidad inválida o vacía" };
      }
      const match =
        (f.codigo_barras && porCod.get(norm(f.codigo_barras))) ||
        (f.sku && porSku.get(norm(f.sku))) ||
        null;
      if (match) {
        return {
          ...f,
          estado: "OK",
          productoId: match.id,
          productoNombre: match.nombre,
          stockActual: match.cantidad,
        };
      }
      return { ...f, estado: "NUEVO", motivo: "No está en el catálogo", añadir: false };
    });

    setFilas(clasificadas);
    setFase("preview");
  }

  const okCount = filas.filter((f) => f.estado === "OK").length;
  const faltaCount = filas.filter((f) => f.estado === "FALTA_DATO").length;
  const nuevoCount = filas.filter((f) => f.estado === "NUEVO").length;
  const añadirCount = filas.filter((f) => f.estado === "NUEVO" && f.añadir).length;

  function toggleAñadir(fila: number) {
    setFilas((prev) =>
      prev.map((f) => (f.fila === fila ? { ...f, añadir: !f.añadir } : f))
    );
  }

  async function aplicar() {
    setFase("aplicando");

    if (DEMO) {
      await new Promise((r) => setTimeout(r, 700));
      setResumen({
        aplicados: okCount,
        creados: añadirCount,
        omitidos: faltaCount + (nuevoCount - añadirCount),
      });
      setFase("hecho");
      return;
    }

    const items: { producto_id: string; cantidad: number }[] = [];

    // 1) Filas OK
    for (const f of filas) {
      if (f.estado === "OK" && f.productoId && f.cantidad != null) {
        items.push({ producto_id: f.productoId, cantidad: f.cantidad });
      }
    }

    // 2) Filas NUEVO marcadas "añadir": crear producto primero
    let creados = 0;
    for (const f of filas) {
      if (f.estado === "NUEVO" && f.añadir && f.cantidad != null) {
        const { data: nuevo, error } = await supabase
          .from("productos")
          .insert({
            negocio_id: negocioId,
            nombre: f.nombre || f.sku || f.codigo_barras || "Producto sin nombre",
            sku: f.sku,
            codigo_barras: f.codigo_barras,
            cantidad: 0,
          })
          .select("id")
          .single();
        if (error || !nuevo) {
          setFase("preview");
          return toast.error(`No se pudo crear ${f.nombre ?? f.sku}: ${error?.message ?? ""}`);
        }
        creados++;
        items.push({ producto_id: nuevo.id, cantidad: f.cantidad });
      }
    }

    if (items.length === 0) {
      setFase("preview");
      return toast.error("No hay filas para aplicar");
    }

    // 3) RPC transaccional
    const { data, error } = await supabase.rpc("importar_movimientos", {
      p_items: items,
      p_modo: modo,
    });
    if (error) {
      setFase("preview");
      return toast.error(error.message);
    }

    const aplicados = (data as { aplicados: number })?.aplicados ?? items.length;
    setResumen({ aplicados: aplicados - creados, creados, omitidos: faltaCount + (nuevoCount - añadirCount) });
    setFase("hecho");
    router.refresh();
  }

  function reiniciar() {
    setFilas([]);
    setResumen(null);
    setFase("subir");
  }

  if (fase === "hecho" && resumen) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
          <h2 className="font-bold text-lg">Importación aplicada</h2>
          <p className="text-sm text-muted-foreground">
            {resumen.aplicados} actualizados · {resumen.creados} creados · {resumen.omitidos} omitidos
          </p>
          <Button onClick={reiniciar} className="w-full">
            Importar otro archivo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Modo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Tipo de archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>¿Qué representa la cantidad?</Label>
          <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VENDIDO">Cantidad vendida (restar del stock)</SelectItem>
              <SelectItem value="STOCK_FINAL">Stock final (fijar el stock)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Subir */}
      {fase === "subir" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Sube el Excel</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed bg-muted/30 cursor-pointer">
              <Upload className="h-7 w-7 text-muted-foreground mb-1" />
              <span className="text-sm text-muted-foreground">Toca para elegir el archivo (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={onArchivo}
              />
            </label>
            <p className="text-xs text-muted-foreground mt-2">
              Detectamos automáticamente las columnas de SKU, código de barras y cantidad.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {(fase === "preview" || fase === "aplicando") && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Resumen label="Coinciden" valor={okCount} tono="ok" />
            <Resumen label="Sin datos" valor={faltaCount} tono="warn" />
            <Resumen label="Nuevos" valor={nuevoCount} tono="new" />
          </div>

          <ul className="divide-y rounded-lg border max-h-[50vh] overflow-auto">
            {filas.map((f) => (
              <li key={f.fila} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {f.productoNombre ?? f.nombre ?? f.sku ?? f.codigo_barras ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Fila {f.fila}
                    {f.cantidad != null ? ` · cant: ${f.cantidad}` : ""}
                    {f.estado === "OK" ? ` · stock: ${f.stockActual}` : ""}
                    {f.motivo ? ` · ${f.motivo}` : ""}
                  </p>
                </div>
                {f.estado === "OK" && (
                  <Badge className="shrink-0 bg-emerald-500/15 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                  </Badge>
                )}
                {f.estado === "FALTA_DATO" && (
                  <Badge variant="destructive" className="shrink-0">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Omitir
                  </Badge>
                )}
                {f.estado === "NUEVO" && (
                  <Button
                    size="sm"
                    variant={f.añadir ? "default" : "outline"}
                    className="shrink-0"
                    onClick={() => toggleAñadir(f.fila)}
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    {f.añadir ? "Añadir" : "Omitir"}
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <Button variant="outline" onClick={reiniciar} className="flex-1" disabled={fase === "aplicando"}>
              Cancelar
            </Button>
            <Button onClick={aplicar} className="flex-1" disabled={fase === "aplicando"}>
              {fase === "aplicando"
                ? "Aplicando…"
                : `Aplicar (${okCount + añadirCount})`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Resumen({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: number;
  tono: "ok" | "warn" | "new";
}) {
  const color =
    tono === "ok" ? "text-emerald-600" : tono === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border p-2">
      <div className={`text-lg font-bold ${color}`}>{valor}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
