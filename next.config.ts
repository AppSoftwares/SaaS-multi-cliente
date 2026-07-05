import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Las fotos se comprimen en el cliente antes de subir; evitamos el
    // optimizador de Next (round-trip) para que carguen al instante.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
};

export default nextConfig;
