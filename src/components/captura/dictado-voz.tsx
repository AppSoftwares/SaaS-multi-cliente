"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

// Tipos mínimos para la Web Speech API (no incluidos en lib.dom por defecto)
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function crearReconocimiento(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
      .SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
      .webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function DictadoVoz({ onTexto }: { onTexto: (t: string) => void }) {
  const [escuchando, setEscuchando] = useState(false);
  const [soportado, setSoportado] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const rec = crearReconocimiento();
    if (!rec) {
      // Sincroniza con la API de plataforma (no hay reconocimiento de voz disponible).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSoportado(false);
      return;
    }
    rec.lang = "es-ES";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const texto = Array.from({ length: e.results.length })
        .map((_, i) => e.results[i][0].transcript)
        .join(" ");
      onTexto(texto);
    };
    rec.onend = () => setEscuchando(false);
    rec.onerror = () => setEscuchando(false);
    recRef.current = rec;
    return () => rec.stop();
  }, [onTexto]);

  if (!soportado) return null;

  function toggle() {
    const rec = recRef.current;
    if (!rec) return;
    if (escuchando) {
      rec.stop();
      setEscuchando(false);
    } else {
      rec.start();
      setEscuchando(true);
    }
  }

  return (
    <Button
      type="button"
      variant={escuchando ? "destructive" : "secondary"}
      onClick={toggle}
      className="w-full"
    >
      {escuchando ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
      {escuchando ? "Escuchando… toca para detener" : "Dictar descripción"}
    </Button>
  );
}
