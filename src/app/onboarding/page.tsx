"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// Primer uso: el usuario crea su negocio y queda como ADMIN (bootstrap_negocio).
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.rpc("bootstrap_negocio", { p_nombre: nombre });
    setCargando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <Card className="w-full max-w-sm animate-in-up">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-white glow-purple text-2xl">
            🏪
          </div>
          <CardTitle className="text-xl text-gradient">Crea tu ferretería</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={crear} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del negocio</Label>
              <Input
                id="nombre"
                required
                placeholder="Ferretería El Tornillo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={cargando}>
              {cargando ? "Creando…" : "Comenzar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
