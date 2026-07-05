"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatUSD, formatBs, formatFecha } from "@/lib/format";
import { DEMO } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, Landmark, Bitcoin, Sparkles } from "lucide-react";
import type { TasasNegocio } from "@/lib/types";

export function ActualizarTasas({ tasasActuales }: { tasasActuales: TasasNegocio | null }) {
  const router = useRouter();
  const supabase = createClient();

  const [bcv, setBcv] = useState<string>(tasasActuales?.tasa_bcv?.toString() ?? "");
  const [binance, setBinance] = useState<string>(tasasActuales?.tasa_binance?.toString() ?? "");
  const [ejemplo, setEjemplo] = useState<string>("12");
  const [cargandoTasas, setCargandoTasas] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  // Trae las tasas automáticamente al abrir
  useEffect(() => {
    traerTasas(true);
  }, []);

  async function traerTasas(silencioso = false) {
    setCargandoTasas(true);
    try {
      if (DEMO) {
        await new Promise((r) => setTimeout(r, 500));
        setBcv("639.70");
        setBinance("737.00");
      } else {
        const res = await fetch("/api/tasas");
        const json = await res.json();
        if (json.bcv) setBcv(String(json.bcv));
        if (json.binance) setBinance(String(json.binance));
        if (!json.bcv && !json.binance && !silencioso) {
          toast.error("No se pudieron traer las tasas. Ingrésalas manualmente.");
        }
      }
    } catch {
      if (!silencioso) toast.error("Error al traer las tasas");
    } finally {
      setCargandoTasas(false);
    }
  }

  // Cálculo del ejemplo en vivo
  const nBcv = Number(bcv);
  const nBin = Number(binance);
  const nEj = Number(ejemplo);
  const tasasOk = nBcv > 0 && nBin > 0;
  const ajustado = tasasOk && nEj > 0 ? Math.round((nEj * nBin) / nBcv * 100) / 100 : 0;
  const enBs = tasasOk && nEj > 0 ? Math.round(nEj * nBin * 100) / 100 : 0;
  const prima = tasasOk ? Math.round((nBin / nBcv - 1) * 1000) / 10 : 0;

  async function aplicar() {
    if (!tasasOk) return toast.error("Ingresa tasas válidas");
    setAplicando(true);
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 700));
      setAplicando(false);
      toast.success("(Demo) Precios en Bs actualizados en todo el catálogo");
      return;
    }
    const { data, error } = await supabase.rpc("actualizar_precios_bs", {
      p_bcv: nBcv,
      p_binance: nBin,
    });
    setAplicando(false);
    if (error) return toast.error(error.message);
    const n = (data as { actualizados: number })?.actualizados ?? 0;
    toast.success(`Precios actualizados en ${n} producto(s)`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {tasasActuales?.tasa_actualizada_at && (
        <p className="text-xs text-muted-foreground">
          Última actualización: {formatFecha(tasasActuales.tasa_actualizada_at)}
        </p>
      )}

      {/* Tasas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Tasas del día
            <Button
              variant="secondary"
              size="sm"
              onClick={() => traerTasas(false)}
              disabled={cargandoTasas}
            >
              <RefreshCw className={`h-4 w-4 ${cargandoTasas ? "animate-spin" : ""}`} /> Traer
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              <Landmark className="h-3.5 w-3.5 text-brand-cyan" /> BCV (Bs/USD)
            </Label>
            <Input
              type="number"
              step="0.0001"
              inputMode="decimal"
              value={bcv}
              onChange={(e) => setBcv(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              <Bitcoin className="h-3.5 w-3.5 text-brand-amber" /> Binance USDT (Bs)
            </Label>
            <Input
              type="number"
              step="0.0001"
              inputMode="decimal"
              value={binance}
              onChange={(e) => setBinance(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ejemplo en vivo */}
      <Card className="!border-primary/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Ejemplo en vivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Precio de venta del producto (USD)</Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={ejemplo}
              onChange={(e) => setEjemplo(e.target.value)}
            />
          </div>

          <div className="rounded-xl glass p-4 space-y-2">
            <Fila label="Precio base" valor={formatUSD(nEj || 0)} />
            <Fila
              label={`USD con conversión (+${prima}%)`}
              valor={formatUSD(ajustado)}
              destacar
            />
            <div className="border-t border-border/50 my-1" />
            <Fila label="A cobrar en bolívares" valor={formatBs(enBs)} grande />
            <p className="text-[11px] text-muted-foreground pt-1">
              Se cotiza <b>{formatUSD(ajustado)}</b> a tasa BCV oficial → equivale al valor real de mercado.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={aplicar} disabled={aplicando || !tasasOk} className="w-full h-12">
        {aplicando ? "Aplicando…" : "Aplicar a todos los productos"}
      </Button>
    </div>
  );
}

function Fila({
  label,
  valor,
  destacar,
  grande,
}: {
  label: string;
  valor: string;
  destacar?: boolean;
  grande?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          grande
            ? "text-xl font-bold text-gradient"
            : destacar
              ? "font-semibold text-brand-cyan"
              : "font-medium"
        }
      >
        {valor}
      </span>
    </div>
  );
}
