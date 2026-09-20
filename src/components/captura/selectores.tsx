"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Undo2 } from "lucide-react";
import type { Categoria, Proveedor } from "@/lib/types";

const NUEVA = "__NUEVA__";

// Campo con búsqueda: se escribe para filtrar las opciones existentes o, si
// no existe, se crea con el texto escrito (se resuelve al guardar). Antes era
// un desplegable con "Nueva…" escondido al final de una lista larga.
export function SelectorCombo({
  label,
  opciones,
  value,
  onChange,
  placeholder = "Escribe o elige…",
}: {
  label?: string;
  opciones: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const texto = value.trim().toLowerCase();
  const existe = opciones.some((o) => o.toLowerCase() === texto);
  const visibles = (texto && !existe ? opciones.filter((o) => o.toLowerCase().includes(texto)) : opciones).slice(0, 60);

  return (
    <div className="space-y-1 relative">
      {label && <Label>{label}</Label>}
      <Input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setAbierto(true);
        }}
      />
      {abierto && (visibles.length > 0 || (texto && !existe)) && (
        <div
          className="absolute z-30 mt-1 w-full glass rounded-xl max-h-56 overflow-y-auto shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {visibles.map((o) => (
            <button
              key={o}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-primary/10 border-b border-border/30 last:border-0"
              onClick={() => {
                onChange(o);
                setAbierto(false);
              }}
            >
              {o}
            </button>
          ))}
          {texto && !existe && (
            <button
              type="button"
              className="flex w-full items-center gap-1 px-3 py-2 text-left text-sm text-primary hover:bg-primary/10"
              onClick={() => setAbierto(false)}
            >
              <Plus className="h-3.5 w-3.5" /> Crear “{value.trim()}”
            </button>
          )}
        </div>
      )}
      {texto && !existe && !abierto && (
        <p className="text-[11px] text-brand-cyan">Se creará: “{value.trim()}”</p>
      )}
    </div>
  );
}

// Selector de categoría en dos niveles (madre → subcategoría).
export function SelectorCategoria({
  categorias,
  madre,
  sub,
  onChange,
}: {
  categorias: Categoria[];
  madre: string;
  sub: string;
  onChange: (madre: string, sub: string) => void;
}) {
  const madres = categorias.filter((c) => !c.parent_id).map((c) => c.nombre);
  const madreObj = categorias.find((c) => !c.parent_id && c.nombre.toLowerCase() === madre.trim().toLowerCase());
  const subs = madreObj
    ? categorias.filter((c) => c.parent_id === madreObj.id).map((c) => c.nombre)
    : [];

  return (
    <div className="grid grid-cols-2 gap-2 col-span-2">
      <SelectorCombo
        label="Categoría"
        opciones={madres}
        value={madre}
        onChange={(v) => onChange(v, "")}
        placeholder="Madre…"
      />
      <SelectorCombo
        label="Subcategoría"
        opciones={subs}
        value={sub}
        onChange={(v) => onChange(madre, v)}
        placeholder={madre ? "Sub…" : "Elige categoría"}
      />
    </div>
  );
}

// Selector de proveedor: lista existente + (opcional) crear uno nuevo al
// vuelo. Crear queda oculto si el usuario no es ADMIN (la RLS de
// `proveedores` solo permite insertar a un ADMIN).
export function SelectorProveedor({
  label = "Proveedor",
  proveedores,
  proveedorId,
  nombreNuevo,
  onChange,
  puedeCrear = true,
}: {
  label?: string;
  proveedores: Proveedor[];
  proveedorId: string;
  nombreNuevo: string;
  onChange: (proveedorId: string, nombreNuevo: string) => void;
  puedeCrear?: boolean;
}) {
  const [modoNueva, setModoNueva] = useState(!proveedorId && nombreNuevo !== "");

  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      {modoNueva ? (
        <div className="flex gap-1">
          <Input
            autoFocus
            placeholder="Nombre del proveedor…"
            value={nombreNuevo}
            onChange={(e) => onChange("", e.target.value)}
          />
          {proveedores.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setModoNueva(false);
                onChange("", "");
              }}
              className="px-2 text-muted-foreground hover:text-foreground"
              aria-label="Volver a la lista"
            >
              <Undo2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <Select
          value={proveedorId}
          onValueChange={(v) => {
            if (v === NUEVA) {
              setModoNueva(true);
              onChange("", "");
            } else {
              onChange(v ?? "", "");
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona…" />
          </SelectTrigger>
          <SelectContent>
            {proveedores.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
            {puedeCrear && (
              <SelectItem value={NUEVA}>
                <span className="flex items-center gap-1 text-primary">
                  <Plus className="h-3.5 w-3.5" /> Nuevo…
                </span>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
