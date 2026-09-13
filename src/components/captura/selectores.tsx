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

// Desplegable con opciones existentes + posibilidad de escribir una nueva.
export function SelectorCombo({
  label,
  opciones,
  value,
  onChange,
  placeholder = "Selecciona…",
}: {
  label?: string;
  opciones: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const existe = opciones.some((o) => o.toLowerCase() === value.trim().toLowerCase());
  const [modoNueva, setModoNueva] = useState(value !== "" && !existe);

  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      {modoNueva ? (
        <div className="flex gap-1">
          <Input
            autoFocus
            placeholder="Escribe el nombre nuevo…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {opciones.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setModoNueva(false);
                onChange("");
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
          value={existe ? value : ""}
          onValueChange={(v) => {
            if (v === NUEVA) {
              setModoNueva(true);
              onChange("");
            } else {
              onChange(v ?? "");
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {opciones.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
            <SelectItem value={NUEVA}>
              <span className="flex items-center gap-1 text-primary">
                <Plus className="h-3.5 w-3.5" /> Nueva…
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}
      {modoNueva && value.trim() && (
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
