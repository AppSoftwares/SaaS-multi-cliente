"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, PackagePlus, PackageCheck } from "lucide-react";
import { DEMO } from "@/lib/demo";
import { resolverCatalogos, resolverProveedor } from "@/lib/catalogos";
import { SelectorCombo, SelectorCategoria, SelectorProveedor } from "@/components/captura/selectores";
import type { Catalogos, Categoria, Proveedor, ResultadoProcesamiento } from "@/lib/types";

interface Props {
  resultado: ResultadoProcesamiento;
  esAdmin: boolean;
  imagenUrl?: string | null;
  catalogos: Catalogos;
  proveedores: Proveedor[];
  negocioId: string;
  onListo: () => void;
}

// Deriva madre/sub desde el texto de categoría que sugiere la IA.
function matchCategoria(cats: Categoria[], texto: string): { madre: string; sub: string } {
  const t = (texto || "").trim().toLowerCase();
  if (!t) return { madre: "", sub: "" };
  const sub = cats.find((c) => c.parent_id && c.nombre.toLowerCase() === t);
  if (sub) {
    const m = cats.find((c) => c.id === sub.parent_id);
    return { madre: m?.nombre ?? "", sub: sub.nombre };
  }
  const madre = cats.find((c) => !c.parent_id && c.nombre.toLowerCase() === t);
  if (madre) return { madre: madre.nombre, sub: "" };
  return { madre: texto.trim(), sub: "" }; // sugerida como nueva madre
}

export function WizardProducto({
  resultado,
  esAdmin,
  imagenUrl,
  catalogos,
  proveedores,
  negocioId,
  onListo,
}: Props) {
  const router = useRouter();
  const isExisting = resultado.status === "EXISTING";
  const [guardando, setGuardando] = useState(false);
  const [cantidadSumar, setCantidadSumar] = useState(1);

  const ia = resultado.datos_ia;
  const catIni = matchCategoria(catalogos.categorias, ia.categoria);
  const [form, setForm] = useState({
    nombre: ia.nombre ?? "",
    catMadre: catIni.madre,
    catSub: catIni.sub,
    marca: ia.marca ?? "",
    descripcion: ia.descripcion ?? "",
    cantidad: ia.cantidad ?? 1,
    sku: ia.sku ?? "",
    codigo_barras: ia.codigo_barras ?? "",
    unidad_medida: ia.unidad_medida || "Unidad",
    precio_venta: ia.precio_venta ?? 0,
    precio_costo: "" as number | "",
    stock_minimo: 0,
    proveedorId: "",
    proveedorNuevo: "",
    ubicacion: "",
  });
  // % de utilidad sobre el costo: si el ADMIN carga costo + utilidad, el
  // precio de venta se calcula solo (venta = costo * (1 + utilidad/100)).
  const [utilidadPct, setUtilidadPct] = useState<number | "">("");

  const faltanDatos = !form.nombre.trim() || !form.catMadre.trim() || !(form.precio_venta > 0);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function calcularPrecioVenta(costo: number | "", utilidad: number | "") {
    if (costo === "" || utilidad === "" || costo <= 0) return;
    const venta = Math.round(costo * (1 + utilidad / 100) * 100) / 100;
    set("precio_venta", venta);
  }

  async function sumarStock() {
    if (!isExisting) return;
    if (DEMO) {
      toast.success(`(Demo) Stock sumado: +${cantidadSumar}`);
      return onListo();
    }
    setGuardando(true);
    const res = await fetch("/api/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "EXISTING",
        producto_id: resultado.producto_bd.id,
        cantidad_sumar: cantidadSumar,
        nota: "Ingreso desde captura",
      }),
    });
    setGuardando(false);
    const json = await res.json();
    if (!res.ok) return toast.error(json.error ?? "Error al sumar stock");
    toast.success(`Stock actualizado: ${json.cantidad_resultante}`);
    router.refresh();
    onListo();
  }

  async function crearProducto() {
    if (DEMO) {
      toast.success(`(Demo) Producto creado: ${form.nombre}`);
      return onListo();
    }
    setGuardando(true);
    // Resuelve/crea categoría (madre/sub), marca y unidad
    const cat = await resolverCatalogos(negocioId, catalogos, {
      madre: form.catMadre,
      sub: form.catSub,
      marca: form.marca,
      unidad: form.unidad_medida,
    });
    const prov = await resolverProveedor(negocioId, proveedores, {
      proveedorId: form.proveedorId,
      nombreNuevo: form.proveedorNuevo,
    });
    const { catMadre: _m, catSub: _s, proveedorId: _pid, proveedorNuevo: _pn, ...rest } = form;
    void _m;
    void _s;
    void _pid;
    void _pn;
    const res = await fetch("/api/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "NEW",
        producto: {
          ...rest,
          categoria: cat.categoria,
          categoria_id: cat.categoria_id,
          marca: cat.marca,
          unidad_medida: cat.unidad_medida,
          proveedor_id: prov.proveedor_id,
          proveedor: prov.proveedor,
          imagen_url: imagenUrl ?? null,
        },
      }),
    });
    setGuardando(false);
    const json = await res.json();
    if (!res.ok) return toast.error(json.error ?? "Error al crear producto");
    toast.success("Producto creado");
    router.refresh();
    onListo();
  }

  if (isExisting) {
    const prod = resultado.producto_bd;
    return (
      <div className="glass rounded-2xl p-4 space-y-4 animate-in-up">
        <div className="rounded-xl gradient-primary text-white glow-purple p-3">
          <h3 className="font-bold flex items-center gap-2">
            <PackageCheck className="h-5 w-5" /> Producto existente
          </h3>
          <p className="text-sm opacity-90">
            {prod.nombre} — stock actual: {prod.cantidad} {prod.unidad_medida}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sumar">¿Cuánto deseas sumar?</Label>
          <Input
            id="sumar"
            type="number"
            min={1}
            inputMode="numeric"
            value={cantidadSumar}
            onChange={(e) => setCantidadSumar(Math.max(1, Number(e.target.value)))}
          />
        </div>

        <Button onClick={sumarStock} disabled={guardando} className="w-full h-12">
          {guardando ? "Guardando…" : "Sumar al inventario"}
        </Button>
      </div>
    );
  }

  // --- NEW ---
  return (
    <div className="glass rounded-2xl p-4 space-y-4 animate-in-up">
      <div className="rounded-xl gradient-cyan text-white glow-cyan p-3 flex items-center gap-3">
        {imagenUrl && (
          <div className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden ring-2 ring-white/40">
            <Image src={imagenUrl} alt="Producto" fill className="object-cover" unoptimized />
          </div>
        )}
        <h3 className="font-bold flex items-center gap-2">
          <PackagePlus className="h-5 w-5" /> Nuevo producto
        </h3>
      </div>

      {faltanDatos && (
        <div className="flex gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Completa los obligatorios: <strong>nombre, categoría y precio de venta</strong>.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nombre *" className="col-span-2" invalido={!form.nombre.trim()}>
          <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
        </Campo>

        {/* Categoría madre / subcategoría */}
        <SelectorCategoria
          categorias={catalogos.categorias}
          madre={form.catMadre}
          sub={form.catSub}
          onChange={(m, s) => setForm((f) => ({ ...f, catMadre: m, catSub: s }))}
        />

        <SelectorCombo
          label="Marca"
          opciones={catalogos.marcas.map((m) => m.nombre)}
          value={form.marca}
          onChange={(v) => set("marca", v)}
        />
        <SelectorCombo
          label="Unidad"
          opciones={catalogos.unidades.map((u) => u.nombre)}
          value={form.unidad_medida}
          onChange={(v) => set("unidad_medida", v)}
        />

        <Campo label="Descripción" className="col-span-2">
          <Input value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
        </Campo>
        <Campo label="Cantidad inicial">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={form.cantidad}
            onChange={(e) => set("cantidad", Math.max(0, Number(e.target.value)))}
          />
        </Campo>
        <Campo label="Stock mínimo">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={form.stock_minimo}
            onChange={(e) => set("stock_minimo", Math.max(0, Number(e.target.value)))}
          />
        </Campo>
        {esAdmin && (
          <Campo label="Precio costo (USD)">
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.precio_costo}
              onChange={(e) => {
                const costo = e.target.value === "" ? "" : Number(e.target.value);
                set("precio_costo", costo);
                calcularPrecioVenta(costo, utilidadPct);
              }}
            />
          </Campo>
        )}
        {esAdmin && (
          <Campo label="% Utilidad">
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="Ej: 30"
              value={utilidadPct}
              onChange={(e) => {
                const pct = e.target.value === "" ? "" : Number(e.target.value);
                setUtilidadPct(pct);
                calcularPrecioVenta(form.precio_costo, pct);
              }}
            />
          </Campo>
        )}
        <Campo label="Precio venta (USD) *" invalido={!(form.precio_venta > 0)}>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={form.precio_venta}
            onChange={(e) => set("precio_venta", Number(e.target.value))}
          />
        </Campo>
        <Campo label="SKU">
          <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} />
        </Campo>
        <Campo label="Código de barras">
          <Input value={form.codigo_barras} onChange={(e) => set("codigo_barras", e.target.value)} />
        </Campo>
        <SelectorProveedor
          proveedores={proveedores}
          proveedorId={form.proveedorId}
          nombreNuevo={form.proveedorNuevo}
          onChange={(id, nuevo) => setForm((f) => ({ ...f, proveedorId: id, proveedorNuevo: nuevo }))}
          puedeCrear={esAdmin}
        />
        <Campo label="Ubicación">
          <Input value={form.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} />
        </Campo>
      </div>

      <Button onClick={crearProducto} disabled={guardando || faltanDatos} className="w-full h-12">
        {guardando ? "Guardando…" : "Crear y guardar"}
      </Button>
    </div>
  );
}

function Campo({
  label,
  children,
  className,
  invalido,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  invalido?: boolean;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className={invalido ? "text-destructive" : undefined}>{label}</Label>
      {children}
    </div>
  );
}
