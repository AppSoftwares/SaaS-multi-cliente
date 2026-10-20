"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { esNativo } from "@/lib/nativo";

export function AvisoRed() {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    const updateOnlineStatus = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    if (esNativo()) {
      import("@capacitor/network").then(({ Network }) => {
        Network.getStatus().then((status) => setOnline(status.connected));
        Network.addListener("networkStatusChange", (status) => {
          setOnline(status.connected);
        });
      });
    }

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Sin conexión a internet: no se pueden registrar ventas o actualizar datos</span>
    </div>
  );
}
