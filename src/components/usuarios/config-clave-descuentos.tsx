"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

// Clave que el cajero debe ingresar en el POS para aplicar un descuento.
// Solo el ADMIN puede configurarla/cambiarla; se guarda hasheada (nunca en texto plano).
export function ConfigClaveDescuentos() {
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (clave.length < 4) return toast.error("La clave debe tener al menos 4 caracteres");
    if (clave !== confirmacion) return toast.error("Las claves no coinciden");

    setGuardando(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 400));
      setGuardando(false);
      setClave("");
      setConfirmacion("");
      return toast.success("(Demo) Clave de descuentos actualizada");
    }
    const supabase = createClient();
    const { error } = await supabase.rpc("set_clave_descuentos", { p_clave: clave });
    setGuardando(false);
    if (error) return toast.error(error.message);
    setClave("");
    setConfirmacion("");
    toast.success("Clave de descuentos actualizada");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" /> Clave de descuentos (Caja)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground pb-3">
          El cajero debe ingresar esta clave para poder aplicar un descuento en el POS, sea por
          producto o sobre el total de la venta.
        </p>
        <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nueva clave</Label>
            <Input
              type="password"
              minLength={4}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Confirmar clave</Label>
            <Input
              type="password"
              minLength={4}
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={guardando} className="col-span-2">
            {guardando ? "Guardando…" : "Guardar clave"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
