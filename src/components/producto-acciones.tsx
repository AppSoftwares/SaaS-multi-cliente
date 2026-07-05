"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { DEMO } from "@/lib/demo";
import { resolverCatalogos } from "@/lib/catalogos";
import { SelectorCombo, SelectorCategoria } from "@/components/captura/selectores";
import type { Catalogos, Categoria, Producto, TipoMovimiento } from "@/lib/types";

// Deriva madre/sub desde el categoria_id guardado en el producto.
function catInicial(cats: Categoria[], categoriaId: string | null): { madre: string; sub: string } {
  if (!categoriaId) return { madre: "", sub: "" };
  const c = cats.find((x) => x.id === categoriaId);
  if (!c) return { madre: "", sub: "" };
  if (c.parent_id) {
    const m = cats.find((x) => x.id === c.parent_id);
    return { madre: m?.nombre ?? "", sub: c.nombre };
  }
  return { madre: c.nombre, sub: "" };
}

// Ajuste de stock + edición del producto (con selectores de catálogo).
export function ProductoAcciones({
  producto,
  esAdmin,
  catalogos,
  negocioId,
}: {
  producto: Producto;
  esAdmin: boolean;
  catalogos: Catalogos;
  negocioId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [tipo, setTipo] = useState<TipoMovimiento>("INGRESO");
  const [cantidad, setCantidad] = useState(1);
  const [proc, setProc] = useState(false);

  async function ajustar() {
    if (DEMO) return toast.success(`(Demo) Movimiento ${tipo} registrado: ${cantidad}`);
    setProc(true);
    const { data, error } = await supabase.rpc("registrar_movimiento", {
      p_producto_id: producto.id,
      p_tipo: tipo,
      p_cantidad: cantidad,
      p_nota: `Ajuste manual (${tipo})`,
    });
    setProc(false);
    if (error) return toast.error(error.message);
    toast.success(`Stock actualizado: ${data}`);
    router.refresh();
  }

  // ---- Edición ----
  const iniCat = catInicial(catalogos.categorias, producto.categoria_id);
  const [edit, setEdit] = useState({
    nombre: producto.nombre,
    catMadre: iniCat.madre,
    catSub: iniCat.sub,
    marca: producto.marca ?? "",
    unidad_medida: producto.unidad_medida,
    precio_venta: producto.precio_venta,
    precio_costo: producto.precio_costo ?? ("" as number | ""),
    stock_minimo: producto.stock_minimo,
    proveedor: producto.proveedor ?? "",
    ubicacion: producto.ubicacion ?? "",
  });
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (DEMO) return toast.success("(Demo) Cambios guardados");
    setGuardando(true);
    const cat = await resolverCatalogos(negocioId, catalogos, {
      madre: edit.catMadre,
      sub: edit.catSub,
      marca: edit.marca,
      unidad: edit.unidad_medida,
    });
    const { error } = await supabase
      .from("productos")
      .update({
        nombre: edit.nombre,
        categoria: cat.categoria,
        categoria_id: cat.categoria_id,
        marca: cat.marca,
        unidad_medida: cat.unidad_medida,
        precio_venta: Number(edit.precio_venta) || 0,
        stock_minimo: Math.max(0, Number(edit.stock_minimo) || 0),
        proveedor: edit.proveedor || null,
        ubicacion: edit.ubicacion || null,
      })
      .eq("id", producto.id);

    if (!error && esAdmin && edit.precio_costo !== "") {
      await supabase.from("productos_costos").upsert({
        producto_id: producto.id,
        negocio_id: producto.negocio_id,
        precio_costo: Number(edit.precio_costo) || 0,
      });
    }
    setGuardando(false);
    if (error) return toast.error(error.message);
    toast.success("Producto actualizado");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Ajuste de stock */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajustar stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMovimiento)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INGRESO">Ingreso (+)</SelectItem>
                  <SelectItem value="VENTA">Venta / salida (−)</SelectItem>
                  <SelectItem value="AJUSTE">Ajuste (fijar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{tipo === "AJUSTE" ? "Stock final" : "Cantidad"}</Label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(0, Number(e.target.value)))}
              />
            </div>
          </div>
          <Button onClick={ajustar} disabled={proc} className="w-full">
            {proc ? "Guardando…" : "Registrar movimiento"}
          </Button>
        </CardContent>
      </Card>

      {/* Edición */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editar producto</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Nombre</Label>
            <Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
          </div>

          <SelectorCategoria
            categorias={catalogos.categorias}
            madre={edit.catMadre}
            sub={edit.catSub}
            onChange={(m, s) => setEdit((f) => ({ ...f, catMadre: m, catSub: s }))}
          />

          <SelectorCombo
            label="Marca"
            opciones={catalogos.marcas.map((m) => m.nombre)}
            value={edit.marca}
            onChange={(v) => setEdit((f) => ({ ...f, marca: v }))}
          />
          <SelectorCombo
            label="Unidad"
            opciones={catalogos.unidades.map((u) => u.nombre)}
            value={edit.unidad_medida}
            onChange={(v) => setEdit((f) => ({ ...f, unidad_medida: v }))}
          />

          <div className="space-y-1">
            <Label>Stock mínimo</Label>
            <Input
              type="number"
              min={0}
              value={edit.stock_minimo}
              onChange={(e) => setEdit({ ...edit, stock_minimo: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Precio venta (USD)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={edit.precio_venta}
              onChange={(e) => setEdit({ ...edit, precio_venta: Number(e.target.value) })}
            />
          </div>
          {esAdmin && (
            <div className="space-y-1">
              <Label>Precio costo (USD)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={edit.precio_costo}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    precio_costo: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </div>
          )}
          <div className="space-y-1">
            <Label>Proveedor</Label>
            <Input
              value={edit.proveedor}
              onChange={(e) => setEdit({ ...edit, proveedor: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Ubicación</Label>
            <Input
              value={edit.ubicacion}
              onChange={(e) => setEdit({ ...edit, ubicacion: e.target.value })}
            />
          </div>
          <Button onClick={guardar} disabled={guardando} className="col-span-2">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
