"use client";

import { useEffect } from "react";
import { inicializarAppNativa } from "@/lib/nativo";

export function InicializadorNativo() {
  useEffect(() => {
    inicializarAppNativa();
  }, []);

  return null;
}
