import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { GestionCatalogos } from "@/components/catalogos/gestion-catalogos";

export default async function CatalogosPage() {
  const sesion = await getSesion();
  if (sesion?.rol !== "ADMIN" || !sesion.negocioId) redirect("/");

  return (
    <div className="space-y-4 animate-in-up">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Categorías, marcas y unidades</h1>
        <p className="text-sm text-muted-foreground">
          Administra las opciones que aparecen al capturar productos.
        </p>
      </div>
      <GestionCatalogos negocioId={sesion.negocioId} />
    </div>
  );
}
