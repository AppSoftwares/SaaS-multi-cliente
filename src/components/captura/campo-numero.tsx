"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

// Campo numérico que respeta lo que el usuario escribe. Un <input type="number">
// controlado con Number(e.target.value) convertía el campo vacío en 0 al
// instante, dejando un "0" pegado que al teclear daba "012", "0.12" o "0.3.69"
// (sobre todo en el teléfono). Aquí el texto es propio: se puede borrar todo,
// el 0 se muestra como vacío con placeholder, y solo se aceptan dígitos (y un
// punto decimal, salvo en modo entero).
export function CampoNumero({
  value,
  onValor,
  entero = false,
  permitirVacio = false,
  placeholder = "0",
  className,
}: {
  value: number | "";
  onValor: (v: number | "") => void;
  entero?: boolean;
  // Si es true, un campo vacío se reporta como "" en vez de 0 (ej. % opcionales).
  permitirVacio?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const aTexto = (v: number | "") => (v === "" || v === 0 ? "" : String(v));
  const [texto, setTexto] = useState(aTexto(value));

  const parsear = (t: string): number => (t === "" || t === "." ? 0 : Number(t) || 0);

  // Si el valor cambia desde fuera (ej. al recalcular por un descuento) y ya
  // no coincide con lo tecleado, se refleja; si coincide, no se toca el texto.
  useEffect(() => {
    const actual = texto === "" && permitirVacio ? "" : parsear(texto);
    if (actual !== value && !(value === "" && texto === "") && !(value === 0 && texto === "")) {
      setTexto(aTexto(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      type="text"
      inputMode={entero ? "numeric" : "decimal"}
      autoComplete="off"
      placeholder={placeholder}
      className={className}
      value={texto}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        let t = e.target.value.replace(",", ".");
        t = entero ? t.replace(/\D/g, "") : t.replace(/[^\d.]/g, "");
        if (!entero) {
          const i = t.indexOf(".");
          if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, "");
        }
        t = t.replace(/^0+(?=\d)/, "");
        setTexto(t);
        onValor(t === "" && permitirVacio ? "" : parsear(t));
      }}
    />
  );
}
