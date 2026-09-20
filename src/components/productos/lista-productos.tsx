"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Pencil, Tags, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import { derivarCategoria, resolverCatalogos } from "@/lib/catalogos";
import { formatBs, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectorCategoria, SelectorCombo } from "@/components/captura/selectores";
import type { Catalogos, Producto } from "@/lib/types";

export interface FiltrosLista {
  q: string;
  f: "" | "sinprecio" | "sincat" | "sinmarca";
  cat: string;
  marca: string;
  unidad: string;
  edicion: boolean;
}

interface Props {
  productos: Producto[];
  total: number;
  pagina: number;
  porPagina: number;
  conteos: { sinPrecio: number; sinCategoria: number; sinMarca: number };
  filtros: FiltrosLista;
  catalogos: Catalogos;
  esAdmin: boolean;
  negocioId: string;
}

const numero = (n: number) => n.toLocaleString("es-VE");
const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const selectCls =
  "h-9 rounded-md border border-input bg-background px-2 text-sm min-w-0 flex-1 basis-[140px]";

export function ListaProductos({
  productos,
  total,
  pagina,
  porPagina,
  conteos,
  filtros,
  catalogos,
  esAdmin,
  negocioId,
}: Props) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dialogLote, setDialogLote] = useState(false);

  const paginas = Math.max(1, Math.ceil(total / porPagina));

  function hrefCon(cambios: Record<string, string>): string {
    const merged: Record<string, string> = {
      q: filtros.q,
      f: filtros.f,
      cat: filtros.cat,
      marca: filtros.marca,
      unidad: filtros.unidad,
      e: filtros.edicion ? "1" : "",
      p: "",
      ...cambios,
    };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/productos?${s}` : "/productos";
  }

  const urlActual = useMemo(
    () => hrefCon({ p: pagina > 1 ? String(pagina) : "" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtros, pagina]
  );

  // Al volver desde una ficha, retoma la posición en la lista.
  useEffect(() => {
    try {
      const k = `prod_scroll:${urlActual}`;
      const v = window.sessionStorage.getItem(k);
      if (v) {
        window.scrollTo(0, Number(v));
        window.sessionStorage.removeItem(k);
      }
    } catch {
      /* sin sessionStorage: no pasa nada */
    }
  }, [urlActual]);

  function recordarPosicion() {
    try {
      window.sessionStorage.setItem(`prod_scroll:${urlActual}`, String(window.scrollY));
    } catch {
      /* ignorar */
    }
  }

  // Limpia la selección al cambiar de página/filtro.
  useEffect(() => {
    setSel(new Set());
  }, [urlActual]);

  const madres = catalogos.categorias.filter((c) => !c.parent_id);
  const hayFiltros = !!(filtros.q || filtros.f || filtros.cat || filtros.marca || filtros.unidad);

  const chips: { id: FiltrosLista["f"]; label: string; n: number }[] = [
    { id: "sinprecio", label: "Sin precio", n: conteos.sinPrecio },
    { id: "sincat", label: "Sin categoría", n: conteos.sinCategoria },
    { id: "sinmarca", label: "Sin marca", n: conteos.sinMarca },
  ];

  function alternar(id: string, marcado: boolean) {
    setSel((s) => {
      const n = new Set(s);
      if (marcado) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  return (
    <div className="space-y-3">
      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const activo = filtros.f === c.id;
          return (
            <Link
              key={c.id}
              href={hrefCon({ f: activo ? "" : c.id })}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activo ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"
              )}
            >
              {c.label}
              <span className="tabular-nums opacity-80">{numero(c.n)}</span>
            </Link>
          );
        })}
      </div>

      {/* Filtros por catálogo */}
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filtrar por categoría"
          className={selectCls}
          value={filtros.cat}
          onChange={(e) => router.push(hrefCon({ cat: e.target.value }))}
        >
          <option value="">Todas las categorías</option>
          {madres.map((m) => (
            <optgroup key={m.id} label={m.nombre}>
              <option value={m.id}>{m.nombre} (todas)</option>
              {catalogos.categorias
                .filter((c) => c.parent_id === m.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <select
          aria-label="Filtrar por marca"
          className={selectCls}
          value={filtros.marca}
          onChange={(e) => router.push(hrefCon({ marca: e.target.value }))}
        >
          <option value="">Todas las marcas</option>
          {catalogos.marcas.map((m) => (
            <option key={m.id} value={m.nombre}>
              {m.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por unidad"
          className={selectCls}
          value={filtros.unidad}
          onChange={(e) => router.push(hrefCon({ unidad: e.target.value }))}
        >
          <option value="">Todas las unidades</option>
          {catalogos.unidades.map((u) => (
            <option key={u.id} value={u.nombre}>
              {u.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {numero(total)} producto{total === 1 ? "" : "s"}
          {hayFiltros ? " con estos filtros" : ""}
        </span>
        <div className="flex items-center gap-3">
          {hayFiltros && (
            <Link href={hrefCon({ q: "", f: "", cat: "", marca: "", unidad: "" })} className="inline-flex items-center gap-1 text-brand-cyan font-medium">
              <X className="h-3 w-3" /> Limpiar filtros
            </Link>
          )}
          {esAdmin && (
            <Link
              href={hrefCon({ e: filtros.edicion ? "" : "1" })}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium",
                filtros.edicion ? "border-primary bg-primary/15 text-primary" : "border-border"
              )}
            >
              <Pencil className="h-3 w-3" /> Edición rápida
            </Link>
          )}
        </div>
      </div>

      {productos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {hayFiltros ? "Ningún producto coincide con estos filtros." : "No hay productos. Usa “Capturar” para agregar el primero."}
        </p>
      ) : filtros.edicion ? (
        <ul className="space-y-2">
          {esAdmin && (
            <li className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Checkbox
                checked={sel.size === productos.length}
                onCheckedChange={(v) => setSel(v ? new Set(productos.map((p) => p.id)) : new Set())}
              />
              Seleccionar los {productos.length} de esta página
            </li>
          )}
          {productos.map((p) => (
            <FilaEdicion
              key={p.id}
              producto={p}
              catalogos={catalogos}
              esAdmin={esAdmin}
              negocioId={negocioId}
              seleccionado={sel.has(p.id)}
              onSeleccion={(v) => alternar(p.id, v)}
            />
          ))}
        </ul>
      ) : (
        <ul className="glass rounded-2xl divide-y divide-border/40 overflow-hidden">
          {productos.map((p) => {
            const bajo = p.stock_minimo > 0 && p.cantidad <= p.stock_minimo;
            return (
              <li key={p.id}>
                <Link
                  href={`/productos/${p.id}?from=${encodeURIComponent(urlActual)}`}
                  onClick={recordarPosicion}
                  className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-primary/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Miniatura p={p} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.marca ? `${p.marca} · ` : ""}
                        {p.categoria ?? "Sin categoría"} ·{" "}
                        <span className={p.precio_venta === 0 ? "text-destructive font-medium" : ""}>
                          {formatUSD(p.precio_venta)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {p.precio_venta_bs > 0 && (
                      <span className="text-xs font-semibold text-brand-cyan">{formatBs(p.precio_venta_bs)}</span>
                    )}
                    <Badge variant={bajo ? "destructive" : "secondary"}>
                      {p.cantidad} {p.unidad_medida}
                    </Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Paginación */}
      {paginas > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          {pagina > 1 ? (
            <Link href={hrefCon({ p: String(pagina - 1) })} className="inline-flex items-center gap-1 text-sm font-medium text-brand-cyan">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            Página {numero(pagina)} de {numero(paginas)}
          </span>
          {pagina < paginas ? (
            <Link href={hrefCon({ p: String(pagina + 1) })} className="inline-flex items-center gap-1 text-sm font-medium text-brand-cyan">
              Siguiente <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}

      {/* Barra de acciones en lote */}
      {filtros.edicion && sel.size > 0 && (
        <div className="sticky bottom-20 z-30 flex items-center justify-between gap-2 rounded-xl glass border border-primary/40 p-3 shadow-lg">
          <span className="text-sm font-medium">{sel.size} seleccionado{sel.size === 1 ? "" : "s"}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSel(new Set())}>
              Quitar
            </Button>
            <Button size="sm" onClick={() => setDialogLote(true)}>
              <Tags className="h-4 w-4 mr-1" /> Asignar categoría / marca
            </Button>
          </div>
        </div>
      )}

      <DialogoLote
        abierto={dialogLote}
        onCerrar={() => setDialogLote(false)}
        ids={[...sel]}
        catalogos={catalogos}
        negocioId={negocioId}
        onListo={() => {
          setDialogLote(false);
          setSel(new Set());
          router.refresh();
        }}
      />
    </div>
  );
}

function Miniatura({ p }: { p: Producto }) {
  return (
    <div className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-muted/40 ring-1 ring-border">
      {p.imagen_url ? (
        <Image src={p.imagen_url} alt={p.nombre} fill className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground text-lg">📦</span>
      )}
    </div>
  );
}

function FilaEdicion({
  producto,
  catalogos,
  esAdmin,
  negocioId,
  seleccionado,
  onSeleccion,
}: {
  producto: Producto;
  catalogos: Catalogos;
  esAdmin: boolean;
  negocioId: string;
  seleccionado: boolean;
  onSeleccion: (v: boolean) => void;
}) {
  const router = useRouter();
  const ini = derivarCategoria(catalogos.categorias, producto.categoria_id);
  const valoresIni = {
    pv: String(producto.precio_venta ?? 0),
    costo: producto.precio_costo != null ? String(producto.precio_costo) : "",
    madre: ini.madre,
    sub: ini.sub,
    marca: producto.marca ?? "",
  };
  const [base, setBase] = useState(valoresIni);
  const [pv, setPv] = useState(valoresIni.pv);
  const [costo, setCosto] = useState(valoresIni.costo);
  const [madre, setMadre] = useState(valoresIni.madre);
  const [sub, setSub] = useState(valoresIni.sub);
  const [marca, setMarca] = useState(valoresIni.marca);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const cambio = pv !== base.pv || costo !== base.costo || madre !== base.madre || sub !== base.sub || marca !== base.marca;

  const madreObj = catalogos.categorias.find((c) => !c.parent_id && igual(c.nombre, madre));
  const subs = madreObj ? catalogos.categorias.filter((c) => c.parent_id === madreObj.id).map((c) => c.nombre) : [];

  async function guardar() {
    const precio = Number(pv);
    if (!Number.isFinite(precio) || precio < 0) return toast.error("Precio de venta inválido");
    if (costo !== "" && (!Number.isFinite(Number(costo)) || Number(costo) < 0)) return toast.error("Costo inválido");
    setGuardando(true);
    if (DEMO) {
      setBase({ pv, costo, madre, sub, marca });
      setGuardado(true);
      setGuardando(false);
      return toast.success("(Demo) Guardado");
    }
    const supabase = createClient();
    const cat = await resolverCatalogos(negocioId, catalogos, {
      madre,
      sub,
      marca,
      unidad: producto.unidad_medida,
    });
    const { error } = await supabase
      .from("productos")
      .update({
        precio_venta: precio,
        categoria: cat.categoria,
        categoria_id: cat.categoria_id,
        marca: cat.marca,
      })
      .eq("id", producto.id);
    if (!error && esAdmin && costo !== "") {
      const { error: errCosto } = await supabase.from("productos_costos").upsert({
        producto_id: producto.id,
        negocio_id: producto.negocio_id,
        precio_costo: Number(costo),
      });
      if (errCosto) toast.error(`Precio guardado, pero el costo falló: ${errCosto.message}`);
    }
    setGuardando(false);
    if (error) return toast.error(error.message);
    setBase({ pv, costo, madre, sub, marca });
    setGuardado(true);

    const nuevoCatalogo =
      (marca.trim() && !catalogos.marcas.some((m) => igual(m.nombre, marca))) ||
      (madre.trim() && !madreObj) ||
      (sub.trim() && !subs.some((s) => igual(s, sub)));
    if (nuevoCatalogo) router.refresh();
  }

  function alEscribir<T>(set: (v: T) => void) {
    return (v: T) => {
      setGuardado(false);
      set(v);
    };
  }

  return (
    <li
      className={cn(
        "glass rounded-2xl p-3 space-y-2 border",
        seleccionado ? "border-primary/60" : "border-transparent",
        cambio && "ring-1 ring-amber-500/60"
      )}
    >
      <div className="flex items-center gap-2">
        {esAdmin && <Checkbox checked={seleccionado} onCheckedChange={(v) => onSeleccion(!!v)} />}
        <p className="font-medium text-sm flex-1 min-w-0 break-words">{producto.nombre}</p>
        <Badge variant="secondary" className="shrink-0">
          {producto.cantidad} {producto.unidad_medida}
        </Badge>
        <Link
          href={`/productos/${producto.id}`}
          aria-label="Abrir ficha completa"
          title="Abrir ficha completa"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Precio venta ($)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={pv}
            className={Number(pv) === 0 ? "border-destructive/60" : ""}
            onChange={(e) => alEscribir(setPv)(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && cambio && guardar()}
          />
        </div>
        {esAdmin ? (
          <div className="space-y-1">
            <Label>Costo ($)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={costo}
              onChange={(e) => alEscribir(setCosto)(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && cambio && guardar()}
            />
          </div>
        ) : (
          <div />
        )}
        <SelectorCombo
          label="Categoría"
          opciones={catalogos.categorias.filter((c) => !c.parent_id).map((c) => c.nombre)}
          value={madre}
          onChange={(v) => {
            setGuardado(false);
            setMadre(v);
            setSub("");
          }}
        />
        <SelectorCombo
          label="Subcategoría"
          opciones={subs}
          value={sub}
          onChange={alEscribir(setSub)}
          placeholder={madre ? "Escribe o elige…" : "Elige categoría"}
        />
        <div className="col-span-2">
          <SelectorCombo
            label="Marca"
            opciones={catalogos.marcas.map((m) => m.nombre)}
            value={marca}
            onChange={alEscribir(setMarca)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {producto.precio_venta_bs > 0 ? `Actual: ${formatBs(producto.precio_venta_bs)}` : "Sin precio en Bs"}
        </span>
        {guardado && !cambio ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-4 w-4" /> Guardado
          </span>
        ) : (
          <Button size="sm" onClick={guardar} disabled={!cambio || guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        )}
      </div>
    </li>
  );
}

function DialogoLote({
  abierto,
  onCerrar,
  ids,
  catalogos,
  negocioId,
  onListo,
}: {
  abierto: boolean;
  onCerrar: () => void;
  ids: string[];
  catalogos: Catalogos;
  negocioId: string;
  onListo: () => void;
}) {
  const [madre, setMadre] = useState("");
  const [sub, setSub] = useState("");
  const [marca, setMarca] = useState("");
  const [unidad, setUnidad] = useState("");
  const [aplicando, setAplicando] = useState(false);

  const algo = madre.trim() || marca.trim() || unidad.trim();

  async function aplicar() {
    if (!algo) return toast.error("Elige al menos una categoría, marca o unidad");
    setAplicando(true);
    if (DEMO) {
      setAplicando(false);
      toast.success(`(Demo) ${ids.length} productos actualizados`);
      return onListo();
    }
    const supabase = createClient();
    const cat = await resolverCatalogos(negocioId, catalogos, { madre, sub, marca, unidad });
    const cambios: Record<string, string | null> = {};
    if (madre.trim()) {
      cambios.categoria = cat.categoria;
      cambios.categoria_id = cat.categoria_id;
    }
    if (marca.trim()) cambios.marca = cat.marca;
    if (unidad.trim()) cambios.unidad_medida = cat.unidad_medida;

    const { error } = await supabase.from("productos").update(cambios).in("id", ids);
    setAplicando(false);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} producto${ids.length === 1 ? "" : "s"} actualizado${ids.length === 1 ? "" : "s"}`);
    setMadre("");
    setSub("");
    setMarca("");
    setUnidad("");
    onListo();
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar a {ids.length} producto{ids.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            Solo se cambian los campos que llenes; lo que dejes vacío se conserva como está.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <SelectorCategoria
            categorias={catalogos.categorias}
            madre={madre}
            sub={sub}
            onChange={(m, s) => {
              setMadre(m);
              setSub(s);
            }}
          />
          <SelectorCombo
            label="Marca"
            opciones={catalogos.marcas.map((m) => m.nombre)}
            value={marca}
            onChange={setMarca}
          />
          <SelectorCombo
            label="Unidad"
            opciones={catalogos.unidades.map((u) => u.nombre)}
            value={unidad}
            onChange={setUnidad}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={aplicar} disabled={aplicando || !algo}>
            {aplicando ? "Aplicando…" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
