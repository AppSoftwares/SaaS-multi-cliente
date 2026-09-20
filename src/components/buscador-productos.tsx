"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// Búsqueda con debounce que sincroniza el término en la URL (?q=) sin perder
// los demás filtros (categoría, marca, sin precio…); al buscar vuelve a la página 1.
export function BuscadorProductos() {
  const router = useRouter();
  const params = useSearchParams();
  const qActual = params.get("q") ?? "";
  const [valor, setValor] = useState(qActual);

  useEffect(() => {
    const q = valor.trim();
    if (q === qActual) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("p");
      const s = next.toString();
      router.replace(s ? `/productos?${s}` : "/productos");
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder="Buscar por nombre, SKU o código…"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
    </div>
  );
}
