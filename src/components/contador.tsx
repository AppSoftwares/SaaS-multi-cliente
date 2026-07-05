"use client";

import { useEffect, useRef, useState } from "react";
import { formatUSD } from "@/lib/format";

// Cuenta de 0 hasta `value` al montar, usando requestAnimationFrame.
// `formato` da formato al valor (no se pueden pasar funciones desde Server Components).
export function Contador({
  value,
  duration = 900,
  formato = "entero",
  className,
}: {
  value: number;
  duration?: number;
  formato?: "entero" | "usd";
  className?: string;
}) {
  const format = (n: number) => (formato === "usd" ? formatUSD(n) : Math.round(n).toString());
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const inicio = performance.now();
    const tick = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duration);
      // easing easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
