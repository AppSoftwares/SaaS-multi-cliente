"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// Búsqueda con debounce que sincroniza el término en la URL (?q=).
export function BuscadorProductos() {
  const router = useRouter();
  const params = useSearchParams();
  const [valor, setValor] = useState(params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const q = valor.trim();
      router.replace(q ? `/productos?q=${encodeURIComponent(q)}` : "/productos");
    }, 300);
    return () => clearTimeout(t);
  }, [valor, router]);

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
