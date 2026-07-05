"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function BotonSalir() {
  const router = useRouter();
  const supabase = createClient();

  async function salir() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" onClick={salir} aria-label="Cerrar sesión">
      <LogOut className="h-5 w-5" />
    </Button>
  );
}
