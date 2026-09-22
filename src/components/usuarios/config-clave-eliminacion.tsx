"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

// Clave para eliminar facturas y proveedores. Es distinta de la clave de
// descuentos (esa la conocen los cajeros): esta debe tenerla solo el dueño.
// Si ya existe, para cambiarla hay que dar la actual.
export function ConfigClaveEliminacion() {
  const [existe, setExiste] = useState<boolean | null>(null);
  const [actual, setActual] = useState("");
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (DEMO) {
      setExiste(false);
      return;
    }
    createClient()
      .rpc("tiene_clave_eliminacion")
      .then(({ data }) => setExiste(!!data));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (clave.length < 4) return toast.error("La clave debe tener al menos 4 caracteres");
    if (clave !== confirmacion) return toast.error("Las claves no coinciden");
    if (existe && !actual) return toast.error("Escribe la clave actual para cambiarla");

    setGuardando(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 400));
      setGuardando(false);
      setExiste(true);
      setActual("");
      setClave("");
      setConfirmacion("");
      return toast.success("(Demo) Clave de eliminación guardada");
    }
    const { error } = await createClient().rpc("set_clave_eliminacion", {
      p_clave: clave,
      p_clave_actual: existe ? actual : null,
    });
    setGuardando(false);
    if (error) return toast.error(error.message);
    setExiste(true);
    setActual("");
    setClave("");
    setConfirmacion("");
    toast.success("Clave de eliminación guardada");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" /> Clave de eliminación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground pb-3">
          Se pide para eliminar facturas de proveedor y proveedores. Guárdala solo tú: no es la clave de descuentos
          que usan los cajeros. {existe ? "Ya hay una clave configurada; para cambiarla escribe la actual." : "Aún no hay una clave: hasta que la crees no se podrá eliminar nada."}
        </p>
        <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
          {existe && (
            <div className="col-span-2 space-y-1">
              <Label>Clave actual</Label>
              <Input type="password" autoComplete="off" value={actual} onChange={(e) => setActual(e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label>{existe ? "Clave nueva" : "Clave"}</Label>
            <Input type="password" minLength={4} autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Confirmar clave</Label>
            <Input type="password" minLength={4} autoComplete="new-password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
          </div>
          <Button type="submit" disabled={guardando || existe === null} className="col-span-2">
            {guardando ? "Guardando…" : existe ? "Cambiar clave" : "Crear clave"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
