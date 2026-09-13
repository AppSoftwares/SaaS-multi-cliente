"use client";

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { TipoDescuento } from "@/lib/types";

// Modal para aplicar un descuento (por línea o general). Si ya hay una clave
// validada en esta venta (claveCacheada) no la vuelve a pedir; si no, la pide
// y la valida contra el servidor antes de dejar aplicar el descuento.
export function ModalDescuento({
  abierto,
  onCerrar,
  titulo,
  claveCacheada,
  onValidarClave,
  onAplicar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  claveCacheada: string | null;
  onValidarClave: (clave: string) => Promise<boolean>;
  onAplicar: (tipo: TipoDescuento, valor: number, claveUsada: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoDescuento>("porcentaje");
  const [valor, setValor] = useState("");
  const [clave, setClave] = useState("");
  const [validando, setValidando] = useState(false);

  function limpiarYCerrar() {
    setTipo("porcentaje");
    setValor("");
    setClave("");
    onCerrar();
  }

  async function aplicar() {
    const v = Number(valor);
    if (!v || v <= 0) return toast.error("Ingresa un valor de descuento válido");
    if (tipo === "porcentaje" && v > 100) return toast.error("El porcentaje no puede superar 100");

    if (claveCacheada) {
      onAplicar(tipo, v, claveCacheada);
      return limpiarYCerrar();
    }

    if (!clave) return toast.error("Ingresa la clave de descuentos");
    setValidando(true);
    const ok = await onValidarClave(clave);
    setValidando(false);
    if (!ok) return toast.error("Clave de descuento inválida");
    onAplicar(tipo, v, clave);
    limpiarYCerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && limpiarYCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {claveCacheada
              ? "Ya validaste la clave de descuentos en esta venta."
              : "Requiere la clave de descuentos que posee el administrador."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tipo de descuento</Label>
            <Select value={tipo} onValueChange={(v) => v && setTipo(v as TipoDescuento)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="porcentaje">Porcentaje (%)</SelectItem>
                <SelectItem value="monto">Monto fijo (Bs)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{tipo === "porcentaje" ? "Porcentaje a descontar" : "Monto a descontar (Bs)"}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus={!!claveCacheada}
            />
          </div>
          {!claveCacheada && (
            <div className="space-y-1">
              <Label>Clave de descuentos</Label>
              <Input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={limpiarYCerrar}>
            Cancelar
          </Button>
          <Button onClick={aplicar} disabled={validando}>
            {validando ? "Verificando…" : "Aplicar descuento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
