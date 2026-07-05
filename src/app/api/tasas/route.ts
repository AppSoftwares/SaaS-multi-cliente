import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Trae la tasa BCV (dolarapi) y el USDT en Binance P2P (criptoya).
// Solo ADMIN. Si alguna fuente falla, devuelve null en ese campo (el cliente
// permite entrada manual).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: rol } = await supabase
    .from("roles_usuario")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  if (rol?.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
  }

  const [bcv, binance] = await Promise.all([fetchBCV(), fetchBinance()]);
  return NextResponse.json({ bcv, binance });
}

async function fetchBCV(): Promise<number | null> {
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const v = Number(json?.promedio);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

async function fetchBinance(): Promise<number | null> {
  try {
    const res = await fetch("https://criptoya.com/api/binancep2p/USDT/VES/1", {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const ask = Number(json?.ask);
    const bid = Number(json?.bid);
    const vals = [ask, bid].filter((n) => Number.isFinite(n) && n > 0);
    if (vals.length === 0) return null;
    const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(prom * 100) / 100;
  } catch {
    return null;
  }
}
