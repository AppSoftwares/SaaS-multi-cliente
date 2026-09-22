"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DEMO } from "@/lib/demo";
import { Button } from "@/components/ui/button";
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
import { KeyRound } from "lucide-react";

// Confirmación de una eliminación con la clave del dueño (distinta de la clave
// de descuentos). El servidor vuelve a validar la clave: esto es solo la UI.
// onConfirmar devuelve un mensaje de error (se muestra y el diálogo sigue
// abierto) o null si salió bien.
export function DialogoClaveEliminar({
  abierto,
  titulo,
  descripcion,
  textoConfirmar = "Eliminar",
  extra,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  titulo: string;
  descripcion: React.ReactNode;
  textoConfirmar?: string;
  extra?: React.ReactNode;
  onCerrar: () => void;
  onConfirmar: (clave: string) => Promise<string | null>;
}) {
  const [clave, setClave] = useState("");
  const [tieneClave, setTieneClave] = useState<boolean | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setClave("");
    setError(null);
    if (DEMO) {
      setTieneClave(true);
      return;
    }
    setTieneClave(null);
    createClient()
      .rpc("tiene_clave_eliminacion")
      .then(({ data }) => setTieneClave(!!data));
  }, [abierto]);

  async function confirmar() {
    setProcesando(true);
    setError(null);
    const msg = await onConfirmar(clave);
    setProcesando(false);
    if (msg) setError(msg);
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && !procesando && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-destructive" /> {titulo}
          </DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        {tieneClave === false ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay una clave de eliminación. Configúrala primero en{" "}
            <Link href="/usuarios" className="text-brand-cyan font-medium underline">
              Usuarios → Clave de eliminación
            </Link>
            .
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (clave && !procesando) confirmar();
            }}
            className="space-y-3"
          >
            {extra}
            <div className="space-y-1">
              <Label>Clave de eliminación</Label>
              <Input
                type="password"
                autoFocus
                autoComplete="off"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                disabled={tieneClave === null}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar} disabled={procesando}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={!clave || procesando || tieneClave === null}>
                {procesando ? "Eliminando…" : textoConfirmar}
              </Button>
            </DialogFooter>
          </form>
        )}
        {tieneClave === false && (
          <DialogFooter>
            <Button variant="outline" onClick={onCerrar}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
