"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Truck, Plus, Pencil, Trash2, X } from "lucide-react";
import { DialogoClaveEliminar } from "@/components/dialogo-clave-eliminar";
import type { Proveedor } from "@/lib/types";

interface FormProveedor {
  nombre: string;
  rif: string;
  telefono: string;
  contacto: string;
  notas: string;
}

const FORM_VACIO: FormProveedor = { nombre: "", rif: "", telefono: "", contacto: "", notas: "" };

export function GestionProveedores({
  negocioId,
  esAdmin,
  inicial,
}: {
  negocioId: string;
  esAdmin: boolean;
  inicial: Proveedor[];
}) {
  const supabase = createClient();
  const [proveedores, setProveedores] = useState<Proveedor[]>(inicial);
  const [form, setForm] = useState<FormProveedor>(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function recargar() {
    if (DEMO) return;
    const { data } = await supabase.from("proveedores").select("*").order("nombre");
    setProveedores((data ?? []) as Proveedor[]);
  }

  function set<K extends keyof FormProveedor>(k: K, v: FormProveedor[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function editar(p: Proveedor) {
    setEditandoId(p.id);
    setForm({
      nombre: p.nombre,
      rif: p.rif ?? "",
      telefono: p.telefono ?? "",
      contacto: p.contacto ?? "",
      notas: p.notas ?? "",
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_VACIO);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) return;
    setGuardando(true);

    const datos = {
      nombre,
      rif: form.rif.trim() || null,
      telefono: form.telefono.trim() || null,
      contacto: form.contacto.trim() || null,
      notas: form.notas.trim() || null,
    };

    if (DEMO) {
      await new Promise((r) => setTimeout(r, 400));
      if (editandoId) {
        setProveedores((ps) => ps.map((p) => (p.id === editandoId ? { ...p, ...datos } : p)));
        toast.success("(Demo) Proveedor actualizado");
      } else {
        setProveedores((ps) => [
          ...ps,
          { id: crypto.randomUUID(), negocio_id: negocioId, activo: true, created_at: new Date().toISOString(), ...datos },
        ]);
        toast.success("(Demo) Proveedor agregado");
      }
      setGuardando(false);
      cancelarEdicion();
      return;
    }

    if (editandoId) {
      const { error } = await supabase.from("proveedores").update(datos).eq("id", editandoId);
      setGuardando(false);
      if (error) return toast.error(error.message);
      toast.success("Proveedor actualizado");
    } else {
      const { error } = await supabase.from("proveedores").insert({ negocio_id: negocioId, ...datos });
      setGuardando(false);
      if (error) return toast.error(error.message);
      toast.success("Proveedor agregado");
    }
    cancelarEdicion();
    recargar();
  }

  // Eliminar pide la clave de eliminación (solo la tiene el dueño); el servidor
  // la valida en eliminar_proveedor, ya no se puede borrar por la API directa.
  const [provEliminar, setProvEliminar] = useState<Proveedor | null>(null);

  async function confirmarEliminar(clave: string): Promise<string | null> {
    const p = provEliminar;
    if (!p) return null;
    if (DEMO) {
      setProveedores((ps) => ps.filter((x) => x.id !== p.id));
      setProvEliminar(null);
      toast.success("(Demo) Proveedor eliminado");
      return null;
    }
    const { error } = await supabase.rpc("eliminar_proveedor", { p_id: p.id, p_clave: clave });
    if (error) return error.message;
    setProvEliminar(null);
    toast.success("Proveedor eliminado");
    recargar();
    return null;
  }

  function eliminar(p: Proveedor) {
    setProvEliminar(p);
  }

  return (
    <div className="space-y-4">
      {esAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {editandoId ? (
                <>
                  <Pencil className="h-4 w-4 text-primary" /> Editar proveedor
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-primary" /> Agregar proveedor
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Nombre *</Label>
                <Input required value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>RIF</Label>
                <Input value={form.rif} onChange={(e) => set("rif", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Contacto</Label>
                <Input value={form.contacto} onChange={(e) => set("contacto", e.target.value)} placeholder="Nombre de la persona de contacto" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Notas</Label>
                <Input value={form.notas} onChange={(e) => set("notas", e.target.value)} placeholder="opcional" />
              </div>
              <div className="col-span-2 flex gap-2">
                {editandoId && (
                  <Button type="button" variant="outline" onClick={cancelarEdicion} className="flex-1">
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={guardando} className="flex-1">
                  {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar proveedor"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proveedores ({proveedores.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {proveedores.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Sin proveedores registrados.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {proveedores.map((p, i) => (
                <li
                  key={p.id}
                  className="stagger-item flex items-center justify-between gap-2 p-3"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0 gradient-primary text-white glow-purple">
                      <Truck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[p.contacto, p.telefono, p.rif].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                      </p>
                    </div>
                  </div>
                  {esAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => editar(p)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => eliminar(p)} aria-label="Eliminar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DialogoClaveEliminar
        abierto={!!provEliminar}
        titulo="Eliminar proveedor"
        descripcion={
          provEliminar
            ? `Se eliminará a ${provEliminar.nombre}. Sus facturas se conservan, pero quedarán sin proveedor.`
            : ""
        }
        onCerrar={() => setProvEliminar(null)}
        onConfirmar={confirmarEliminar}
      />
    </div>
  );
}
