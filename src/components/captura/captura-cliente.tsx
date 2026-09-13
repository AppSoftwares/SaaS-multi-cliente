"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { comprimirYSubir } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera, ScanLine, Sparkles, RotateCcw } from "lucide-react";
import { DictadoVoz } from "@/components/captura/dictado-voz";
import { EscanerBarcode } from "@/components/captura/escaner-barcode";
import { WizardProducto } from "@/components/wizard-producto";
import { DEMO, demoProductos } from "@/lib/demo";
import type { Catalogos, Producto, Proveedor, ResultadoProcesamiento } from "@/lib/types";

type Vista = "inicio" | "foto" | "procesando" | "wizard";

export function CapturaCliente({
  esAdmin,
  catalogos,
  proveedores,
  negocioId,
}: {
  esAdmin: boolean;
  catalogos: Catalogos;
  proveedores: Proveedor[];
  negocioId: string;
}) {
  const [vista, setVista] = useState<Vista>("inicio");
  const [scanner, setScanner] = useState(false);
  const [texto, setTexto] = useState("");
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcesamiento | null>(null);
  const [codigoPre, setCodigoPre] = useState<string | null>(null);

  function reiniciar() {
    setVista("inicio");
    setTexto("");
    setImagenUrl(null);
    setPreview(null);
    setResultado(null);
    setCodigoPre(null);
  }

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setPreview(URL.createObjectURL(file));
    try {
      const url = await comprimirYSubir(file);
      setImagenUrl(url);
    } catch {
      toast.error("No se pudo subir la imagen");
      setPreview(null);
    } finally {
      setSubiendo(false);
    }
  }

  async function analizar() {
    if (!texto.trim() && !imagenUrl) {
      toast.error("Toma una foto o dicta una descripción");
      return;
    }
    setVista("procesando");

    if (DEMO) {
      // Simula la extracción de la IA con datos de ejemplo.
      await new Promise((r) => setTimeout(r, 900));
      setResultado({
        status: "NEW",
        datos_ia: {
          categoria: "Herramientas eléctricas",
          nombre: texto.trim() || "Rotomartillo 800W",
          descripcion: "Detectado por IA (demo). Revisa y edita los campos.",
          cantidad: 1,
          sku: null,
          codigo_barras: codigoPre,
          marca: null,
          unidad_medida: "Unidad",
          precio_venta: 95.0,
        },
      });
      setVista("wizard");
      return;
    }

    const res = await fetch("/api/procesar-ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, imagenUrl }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Error al procesar");
      setVista("foto");
      return;
    }
    // Precarga del código escaneado si venía de barcode
    if (codigoPre && json.status === "NEW") {
      json.datos_ia.codigo_barras = codigoPre;
    }
    setResultado(json as ResultadoProcesamiento);
    setVista("wizard");
  }

  async function onBarcode(codigo: string) {
    setScanner(false);
    let data: Producto | null;
    if (DEMO) {
      data = demoProductos.find((p) => p.codigo_barras === codigo) ?? null;
    } else {
      const supabase = createClient();
      const res = await supabase
        .from("productos")
        .select("*")
        .eq("codigo_barras", codigo)
        .limit(1)
        .maybeSingle();
      data = (res.data as Producto) ?? null;
    }

    if (data) {
      const prod = data as Producto;
      setResultado({
        status: "EXISTING",
        producto_bd: prod,
        datos_ia: {
          categoria: prod.categoria ?? "",
          nombre: prod.nombre,
          descripcion: prod.descripcion ?? "",
          cantidad: 1,
          sku: prod.sku,
          codigo_barras: prod.codigo_barras,
          marca: prod.marca,
          unidad_medida: prod.unidad_medida,
          precio_venta: prod.precio_venta,
        },
        mensaje: `Producto: ${prod.nombre}`,
      });
      setVista("wizard");
    } else {
      // No existe: pasar a alta con el código precargado
      toast.info("Código no registrado. Crea el producto nuevo.");
      setCodigoPre(codigo);
      setVista("foto");
    }
  }

  if (scanner) {
    return <EscanerBarcode onDetectado={onBarcode} onCerrar={() => setScanner(false)} />;
  }

  return (
    <div className="space-y-4 animate-in-up">
      <h1 className="text-2xl font-bold text-gradient">Capturar producto</h1>

      {vista === "inicio" && (
        <div className="grid gap-3">
          <Button className="h-16 text-base" onClick={() => setScanner(true)}>
            <ScanLine className="mr-2 h-6 w-6" /> Escanear código (reponer)
          </Button>
          <Button
            variant="secondary"
            className="h-16 text-base"
            onClick={() => setVista("foto")}
          >
            <Camera className="mr-2 h-6 w-6" /> Foto + voz (producto nuevo)
          </Button>
        </div>
      )}

      {vista === "foto" && (
        <div className="space-y-4">
          {codigoPre && (
            <p className="text-sm text-muted-foreground">
              Código escaneado: <span className="font-mono">{codigoPre}</span>
            </p>
          )}

          <label className="block">
            <div className="flex items-center justify-center h-44 rounded-xl border-2 border-dashed bg-muted/30 overflow-hidden relative cursor-pointer">
              {preview ? (
                <Image src={preview} alt="Vista previa" fill className="object-cover" unoptimized />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Camera className="h-8 w-8 mx-auto mb-1" />
                  <span className="text-sm">{subiendo ? "Subiendo…" : "Toca para tomar foto"}</span>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={elegirFoto}
            />
          </label>

          <DictadoVoz onTexto={(t) => setTexto((prev) => (prev ? `${prev} ${t}` : t))} />

          <Textarea
            placeholder="Descripción (puedes dictarla o escribirla)…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
          />

          <div className="flex gap-2">
            <Button variant="outline" onClick={reiniciar} className="flex-1">
              <RotateCcw className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={analizar} disabled={subiendo} className="flex-1">
              <Sparkles className="mr-2 h-4 w-4" /> Analizar con IA
            </Button>
          </div>
        </div>
      )}

      {vista === "procesando" && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Sparkles className="h-8 w-8 animate-pulse mb-2" />
          <p>Analizando con IA…</p>
        </div>
      )}

      {vista === "wizard" && resultado && (
        <div className="space-y-3">
          <WizardProducto
            resultado={resultado}
            esAdmin={esAdmin}
            imagenUrl={imagenUrl}
            catalogos={catalogos}
            proveedores={proveedores}
            negocioId={negocioId}
            onListo={reiniciar}
          />
          <Button variant="ghost" onClick={reiniciar} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" /> Capturar otro
          </Button>
        </div>
      )}
    </div>
  );
}
