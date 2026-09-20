"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DEMO, demoCatalogos } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, FolderTree, Tag, Ruler } from "lucide-react";
import type { Categoria, OpcionCatalogo } from "@/lib/types";

export interface ConteosCatalogo {
  categoria: Record<string, number>;
  marca: Record<string, number>;
  unidad: Record<string, number>;
}

export function GestionCatalogos({ negocioId, conteos }: { negocioId: string; conteos: ConteosCatalogo }) {
  const supabase = createClient();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<OpcionCatalogo[]>([]);
  const [unidades, setUnidades] = useState<OpcionCatalogo[]>([]);

  async function cargar() {
    if (DEMO) {
      setCategorias(demoCatalogos.categorias);
      setMarcas(demoCatalogos.marcas);
      setUnidades(demoCatalogos.unidades);
      return;
    }
    const [c, m, u] = await Promise.all([
      supabase.from("categorias").select("id, nombre, parent_id").order("nombre"),
      supabase.from("marcas").select("id, nombre").order("nombre"),
      supabase.from("unidades").select("id, nombre").order("nombre"),
    ]);
    setCategorias(c.data ?? []);
    setMarcas(m.data ?? []);
    setUnidades(u.data ?? []);
  }

  useEffect(() => {
    // Carga inicial de catálogos al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Operaciones genéricas para marcas/unidades ----
  async function agregarSimple(tabla: "marcas" | "unidades", nombre: string) {
    const n = nombre.trim();
    if (!n) return;
    if (DEMO) {
      const item = { id: crypto.randomUUID(), nombre: n };
      if (tabla === "marcas") setMarcas((x) => [...x, item]);
      else setUnidades((x) => [...x, item]);
      return toast.success("(Demo) Agregado");
    }
    const { error } = await supabase.from(tabla).insert({ negocio_id: negocioId, nombre: n });
    if (error) return toast.error(error.message);
    cargar();
  }
  async function eliminarSimple(tabla: "marcas" | "unidades" | "categorias", id: string) {
    if (DEMO) {
      if (tabla === "marcas") setMarcas((x) => x.filter((i) => i.id !== id));
      else if (tabla === "unidades") setUnidades((x) => x.filter((i) => i.id !== id));
      else setCategorias((x) => x.filter((i) => i.id !== id && i.parent_id !== id));
      return toast.success("(Demo) Eliminado");
    }
    const { error } = await supabase.from(tabla).delete().eq("id", id);
    if (error) return toast.error(error.message);
    cargar();
  }

  // ---- Categorías ----
  async function agregarCategoria(nombre: string, parentId: string | null) {
    const n = nombre.trim();
    if (!n) return;
    if (DEMO) {
      setCategorias((x) => [...x, { id: crypto.randomUUID(), nombre: n, parent_id: parentId }]);
      return toast.success("(Demo) Categoría agregada");
    }
    const { error } = await supabase
      .from("categorias")
      .insert({ negocio_id: negocioId, nombre: n, parent_id: parentId });
    if (error) return toast.error(error.message);
    cargar();
  }

  const madres = categorias.filter((c) => !c.parent_id);

  return (
    <Tabs defaultValue="categorias">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="categorias">
          <FolderTree className="h-4 w-4 mr-1" /> Categorías
        </TabsTrigger>
        <TabsTrigger value="marcas">
          <Tag className="h-4 w-4 mr-1" /> Marcas
        </TabsTrigger>
        <TabsTrigger value="unidades">
          <Ruler className="h-4 w-4 mr-1" /> Unidades
        </TabsTrigger>
      </TabsList>

      {/* CATEGORÍAS */}
      <TabsContent value="categorias" className="space-y-3 pt-3">
        <AgregarInline placeholder="Nueva categoría madre…" onAdd={(v) => agregarCategoria(v, null)} />
        {madres.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Link
                  href={`/productos?cat=${m.id}`}
                  className="font-semibold hover:text-primary"
                  title={`Ver los productos de ${m.nombre}`}
                >
                  {m.nombre}{" "}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    ·{" "}
                    {(conteos.categoria[m.id] ?? 0) +
                      categorias
                        .filter((c) => c.parent_id === m.id)
                        .reduce((n, c) => n + (conteos.categoria[c.id] ?? 0), 0)}{" "}
                    productos
                  </span>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => eliminarSimple("categorias", m.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categorias
                  .filter((c) => c.parent_id === m.id)
                  .map((s) => (
                    <Badge key={s.id} variant="secondary" className="gap-1">
                      <Link
                        href={`/productos?cat=${s.id}`}
                        title={`Ver los productos de ${s.nombre}`}
                        className="hover:text-primary"
                      >
                        {s.nombre} · {conteos.categoria[s.id] ?? 0}
                      </Link>
                      <button onClick={() => eliminarSimple("categorias", s.id)} aria-label="Eliminar">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </Badge>
                  ))}
              </div>
              <AgregarInline placeholder="Subcategoría…" small onAdd={(v) => agregarCategoria(v, m.id)} />
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      {/* MARCAS */}
      <TabsContent value="marcas" className="space-y-3 pt-3">
        <AgregarInline placeholder="Nueva marca…" onAdd={(v) => agregarSimple("marcas", v)} />
        <ListaChips
          items={marcas}
          onDelete={(id) => eliminarSimple("marcas", id)}
          hrefDe={(i) => `/productos?marca=${encodeURIComponent(i.nombre)}`}
          conteoDe={(i) => conteos.marca[i.nombre] ?? 0}
        />
      </TabsContent>

      {/* UNIDADES */}
      <TabsContent value="unidades" className="space-y-3 pt-3">
        <AgregarInline placeholder="Nueva unidad…" onAdd={(v) => agregarSimple("unidades", v)} />
        <ListaChips
          items={unidades}
          onDelete={(id) => eliminarSimple("unidades", id)}
          hrefDe={(i) => `/productos?unidad=${encodeURIComponent(i.nombre)}`}
          conteoDe={(i) => conteos.unidad[i.nombre] ?? 0}
        />
      </TabsContent>
    </Tabs>
  );
}

function AgregarInline({
  placeholder,
  onAdd,
  small,
}: {
  placeholder: string;
  onAdd: (v: string) => void;
  small?: boolean;
}) {
  const [v, setV] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(v);
        setV("");
      }}
      className="flex gap-2"
    >
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        className={small ? "h-8" : ""}
      />
      <Button type="submit" size={small ? "sm" : "default"} disabled={!v.trim()}>
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}

function ListaChips({
  items,
  onDelete,
  hrefDe,
  conteoDe,
}: {
  items: OpcionCatalogo[];
  onDelete: (id: string) => void;
  hrefDe: (i: OpcionCatalogo) => string;
  conteoDe: (i: OpcionCatalogo) => number;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin elementos.</p>
        ) : (
          items.map((i) => (
            <Badge key={i.id} variant="secondary" className="gap-1">
              <Link href={hrefDe(i)} title={`Ver los productos de ${i.nombre}`} className="hover:text-primary">
                {i.nombre} · {conteoDe(i)}
              </Link>
              <button onClick={() => onDelete(i.id)} aria-label="Eliminar">
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </Badge>
          ))
        )}
      </CardContent>
    </Card>
  );
}
