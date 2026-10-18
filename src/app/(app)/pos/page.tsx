import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { getNegocioNombre } from "@/lib/negocio";
import { PosCliente } from "@/components/pos/pos-cliente";
import {
  DEMO,
  demoMetodosPago,
  DEMO_BCV,
  DEMO_BINANCE,
  DEMO_IVA_TASA,
  DEMO_IGTF_TASA,
  demoTurnoAbierto,
  demoEstadoCajas,
} from "@/lib/demo";
import type { EstadoCajaVendedor, MapaPermisos, MetodoPago, TurnoCaja } from "@/lib/types";
import { puede } from "@/lib/permisos";

export default async function PosPage() {
  const sesion = await getSesion();
  let puedeAbrirCaja = true;

  let metodosPago: MetodoPago[];
  let negocioNombre: string;
  let tasaBcv: number | null;
  let tasaBinance: number | null;
  let ivaTasa: number;
  let igtfTasa: number;
  let turnoAbierto: TurnoCaja | null;
  let estadoCajas: EstadoCajaVendedor[] = [];

  if (DEMO) {
    metodosPago = demoMetodosPago;
    negocioNombre = "Mi Ferretería";
    tasaBcv = DEMO_BCV;
    tasaBinance = DEMO_BINANCE;
    ivaTasa = DEMO_IVA_TASA;
    igtfTasa = DEMO_IGTF_TASA;
    turnoAbierto = demoTurnoAbierto;
    estadoCajas = demoEstadoCajas;
  } else {
    const supabase = await createClient();
    const { data: mp } = await supabase.rpc("mis_permisos");
    puedeAbrirCaja = puede(((mp as { modulos?: MapaPermisos } | null)?.modulos ?? {}) as MapaPermisos, "apertura_caja", "editar");
    const [metodosRes, negocioRes, turnoRes, estadoCajasRes] = await Promise.all([
      supabase.from("metodos_pago").select("*").eq("activo", true).order("tipo"),
      supabase
        .from("negocios")
        .select("tasa_bcv, tasa_binance, iva_tasa, igtf_tasa")
        .eq("id", sesion?.negocioId ?? "")
        .maybeSingle(),
      // El turno propio: cada vendedor/líder tiene su propia caja, no una
      // compartida por negocio.
      supabase
        .from("turnos_caja")
        .select("*")
        .eq("usuario_id", sesion?.userId ?? "")
        .eq("estado", "abierto")
        .maybeSingle(),
      puedeAbrirCaja ? supabase.rpc("listar_estado_cajas") : Promise.resolve({ data: null }),
    ]);
    metodosPago = (metodosRes.data ?? []) as MetodoPago[];
    tasaBcv = negocioRes.data?.tasa_bcv ?? null;
    tasaBinance = negocioRes.data?.tasa_binance ?? null;
    ivaTasa = negocioRes.data?.iva_tasa ?? 16;
    igtfTasa = negocioRes.data?.igtf_tasa ?? 3;
    turnoAbierto = (turnoRes.data ?? null) as TurnoCaja | null;
    estadoCajas = (estadoCajasRes.data ?? []) as EstadoCajaVendedor[];
    negocioNombre = await getNegocioNombre(sesion?.negocioId ?? null);
  }

  return (
    <PosCliente
      metodosPago={metodosPago}
      negocioNombre={negocioNombre}
      tasaBcv={tasaBcv}
      tasaBinance={tasaBinance}
      ivaTasa={ivaTasa}
      igtfTasa={igtfTasa}
      turnoInicial={turnoAbierto}
      puedeAbrirCaja={puedeAbrirCaja}
      estadoCajasInicial={estadoCajas}
      miUserId={DEMO ? "demo-user" : sesion?.userId ?? ""}
    />
  );
}
