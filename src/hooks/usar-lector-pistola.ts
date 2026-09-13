"use client";

import { useCallback, useState } from "react";

// Hook para un input dedicado a la pistola de código de barras (HID): el
// dispositivo "tipea" el código y termina con Enter. Al ser un campo exclusivo
// para esto (no compartido con búsqueda manual) no hace falta distinguir
// velocidad de tecleo: basta con leer el valor al presionar Enter.
export function useLectorPistola(onCodigo: (codigo: string) => void) {
  const [valor, setValor] = useState("");

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValor(e.target.value);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const codigo = e.currentTarget.value.trim();
      if (codigo) onCodigo(codigo);
      setValor("");
    },
    [onCodigo]
  );

  return { valor, onChange, onKeyDown };
}
