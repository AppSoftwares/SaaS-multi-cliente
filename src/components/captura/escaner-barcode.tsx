"use client";

import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Abre la cámara y escanea un código de barras. Llama onDetectado con el texto.
export function EscanerBarcode({
  onDetectado,
  onCerrar,
}: {
  onDetectado: (codigo: string) => void;
  onCerrar: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | null = null;
    let cancelado = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result && !cancelado) {
          cancelado = true;
          onDetectado(result.getText());
          controls?.stop();
        }
      })
      .then((c) => {
        controls = c;
        if (cancelado) c.stop();
      })
      .catch(() => {
        /* permiso denegado o sin cámara */
      });

    return () => {
      cancelado = true;
      controls?.stop();
    };
  }, [onDetectado]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 text-white">
        <span className="text-sm">Apunta al código de barras</span>
        <Button variant="ghost" size="icon" onClick={onCerrar} className="text-white">
          <X className="h-6 w-6" />
        </Button>
      </div>
      <div className="flex-1 relative">
        <video ref={videoRef} className="w-full h-full object-cover" />
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-white/80 rounded-lg" />
      </div>
    </div>
  );
}
