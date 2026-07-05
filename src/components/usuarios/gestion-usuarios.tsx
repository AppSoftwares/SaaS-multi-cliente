"use client";

import { useEffect, useState } from "react";
import { DEMO } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { UserPlus, Trash2, Shield, User } from "lucide-react";
import type { Rol, UsuarioNegocio } from "@/lib/types";

const DEMO_USUARIOS: UsuarioNegocio[] = [
  { id: "demo-user", username: "admin", email: "demo@ferreteria.com", rol: "ADMIN", created_at: new Date().toISOString() },
  { id: "u2", username: "juan", email: "juan@ferreteria.com", rol: "ALMACEN", created_at: new Date().toISOString() },
];

export function GestionUsuarios({ miId }: { miId: string }) {
  const [usuarios, setUsuarios] = useState<UsuarioNegocio[]>([]);
  const [cargando, setCargando] = useState(true);

  // Formulario de alta
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("ALMACEN");
  const [creando, setCreando] = useState(false);

  async function cargar() {
    setCargando(true);
    if (DEMO) {
      setUsuarios(DEMO_USUARIOS);
      setCargando(false);
      return;
    }
    const res = await fetch("/api/usuarios");
    const json = await res.json();
    setCargando(false);
    if (!res.ok) return toast.error(json.error ?? "Error al cargar usuarios");
    setUsuarios(json.usuarios ?? []);
  }

  useEffect(() => {
    // Carga inicial de la lista al montar (sincroniza con el servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 500));
      setUsuarios((u) => [
        ...u,
        { id: crypto.randomUUID(), username: username || email.split("@")[0], email, rol, created_at: new Date().toISOString() },
      ]);
      setCreando(false);
      setEmail(""); setUsername(""); setPassword("");
      return toast.success("(Demo) Usuario creado");
    }
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username, rol }),
    });
    const json = await res.json();
    setCreando(false);
    if (!res.ok) return toast.error(json.error ?? "Error al crear");
    toast.success("Usuario creado");
    setEmail(""); setUsername(""); setPassword("");
    cargar();
  }

  async function cambiarRol(u: UsuarioNegocio) {
    const nuevo: Rol = u.rol === "ADMIN" ? "ALMACEN" : "ADMIN";
    if (DEMO) {
      setUsuarios((us) => us.map((x) => (x.id === u.id ? { ...x, rol: nuevo } : x)));
      return toast.success(`(Demo) ${u.username} ahora es ${nuevo}`);
    }
    const res = await fetch("/api/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, rol: nuevo }),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error ?? "Error");
    toast.success(`Rol actualizado a ${nuevo}`);
    cargar();
  }

  async function eliminar(u: UsuarioNegocio) {
    if (!confirm(`¿Eliminar a ${u.username ?? u.email}?`)) return;
    if (DEMO) {
      setUsuarios((us) => us.filter((x) => x.id !== u.id));
      return toast.success("(Demo) Usuario eliminado");
    }
    const res = await fetch(`/api/usuarios?id=${u.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error ?? "Error");
    toast.success("Usuario eliminado");
    cargar();
  }

  return (
    <div className="space-y-4">
      {/* Alta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Agregar usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={crear} className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Correo</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Usuario</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="opcional" />
            </div>
            <div className="space-y-1">
              <Label>Rol</Label>
              <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALMACEN">Almacén (operario)</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Contraseña</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={creando} className="col-span-2">
              {creando ? "Creando…" : "Crear usuario"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios ({usuarios.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cargando ? (
            <p className="text-sm text-muted-foreground p-4">Cargando…</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {usuarios.map((u, i) => (
                <li
                  key={u.id}
                  className="stagger-item flex items-center justify-between gap-2 p-3"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${
                        u.rol === "ADMIN" ? "gradient-primary text-white glow-purple" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {u.rol === "ADMIN" ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {u.username ?? "—"}
                        {u.id === miId && <span className="text-xs text-muted-foreground"> (tú)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => cambiarRol(u)} disabled={u.id === miId} className="disabled:opacity-40">
                      <Badge variant={u.rol === "ADMIN" ? "default" : "secondary"} className="cursor-pointer">
                        {u.rol}
                      </Badge>
                    </button>
                    {u.id !== miId && (
                      <Button variant="ghost" size="icon" onClick={() => eliminar(u)} aria-label="Eliminar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground p-3 pt-2">
            Toca el rol para alternar entre ADMIN y ALMACÉN. El operario (ALMACÉN) no ve costos ni márgenes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
