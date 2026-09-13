"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setCargando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      // Confirmación de email desactivada -> ya hay sesión
      router.replace("/onboarding");
      router.refresh();
    } else {
      toast.success("Cuenta creada. Revisa tu correo para confirmarla.");
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <Card className="w-full max-w-sm animate-in-up">
        <CardHeader className="items-center text-center">
          <Image
            src="/logo.jpeg"
            alt="Logo"
            width={112}
            height={56}
            priority
            className="mb-1 h-14 w-auto rounded-xl object-contain"
          />
          <CardTitle className="text-2xl text-gradient">Inventario IA</CardTitle>
          <p className="text-xs text-muted-foreground">Ferretería inteligente</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ingresar">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ingresar">Ingresar</TabsTrigger>
              <TabsTrigger value="registrar">Registrar</TabsTrigger>
            </TabsList>

            <TabsContent value="ingresar">
              <form onSubmit={ingresar} className="space-y-4 pt-2">
                <Campos
                  email={email}
                  password={password}
                  setEmail={setEmail}
                  setPassword={setPassword}
                />
                <Button type="submit" className="w-full" disabled={cargando}>
                  {cargando ? "Ingresando…" : "Ingresar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="registrar">
              <form onSubmit={registrar} className="space-y-4 pt-2">
                <Campos
                  email={email}
                  password={password}
                  setEmail={setEmail}
                  setPassword={setPassword}
                />
                <Button type="submit" className="w-full" disabled={cargando}>
                  {cargando ? "Creando…" : "Crear cuenta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function Campos({
  email,
  password,
  setEmail,
  setPassword,
}: {
  email: string;
  password: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </>
  );
}
