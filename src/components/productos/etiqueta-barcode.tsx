"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

// Etiqueta imprimible (código de barras + nombre) para pegar físicamente al
// producto. El botón queda oculto al imprimir vía la variante print:hidden.
export function EtiquetaBarcode({ nombre, codigo }: { nombre: string; codigo: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, codigo, {
        format: "EAN13",
        width: 2,
        height: 50,
        fontSize: 14,
        margin: 6,
      });
    } catch {
      JsBarcode(svgRef.current, codigo, {
        format: "CODE128",
        width: 2,
        height: 50,
        fontSize: 14,
        margin: 6,
      });
    }
  }, [codigo]);

  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-lg border bg-white p-3 text-black">
      <p className="max-w-[180px] truncate text-center text-xs font-medium">{nombre}</p>
      <svg ref={svgRef} />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="print:hidden"
        onClick={() => window.print()}
      >
        <Printer className="mr-1 h-3.5 w-3.5" /> Imprimir etiqueta
      </Button>
    </div>
  );
}
