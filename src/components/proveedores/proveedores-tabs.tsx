"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GestionProveedores } from "@/components/proveedores/gestion-proveedores";
import { FacturasLista } from "@/components/proveedores/facturas-lista";
import { FacturaWizard } from "@/components/proveedores/factura-wizard";
import { formatFecha } from "@/lib/format";
import type { Catalogos, Factura, FacturaItem, PagoProveedor, Proveedor } from "@/lib/types";
import type { BorradorResumen } from "@/app/(app)/proveedores/page";

export function ProveedoresTabs({
  negocioId,
  esAdmin,
  proveedores,
  facturas,
  pagos,
  catalogos,
  borradores,
}: {
  negocioId: string;
  esAdmin: boolean;
  proveedores: Proveedor[];
  facturas: (Factura & { proveedor_nombre?: string | null })[];
  pagos: PagoProveedor[];
  catalogos: Catalogos;
  borradores: BorradorResumen[];
}) {
  const router = useRouter();
  const [mostrarWizard, setMostrarWizard] = useState(false);
  const [borradoresLista, setBorradoresLista] = useState(borradores);
  const [borradorInicial, setBorradorInicial] = useState<{ factura: Factura; items: FacturaItem[] } | null>(null);
  const [cargandoBorrador, setCargandoBorrador] = useState<string | null>(null);

  async function continuarBorrador(id: string) {
    setCargandoBorrador(id);
    const res = await fetch(`/api/facturas/borrador/${id}`);
    setCargandoBorrador(null);
    if (!res.ok) return toast.error("No se pudo abrir el borrador");
    const json = await res.json();
    setBorradorInicial({ factura: json.factura, items: json.items });
    setMostrarWizard(true);
  }

  async function descartarBorrador(id: string) {
    if (!confirm("¿Descartar este borrador? No se puede deshacer.")) return;
    const res = await fetch(`/api/facturas/borrador/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("No se pudo descartar el borrador");
    setBorradoresLista((bs) => bs.filter((b) => b.id !== id));
    toast.success("Borrador descartado");
  }

  function cerrarWizard() {
    setMostrarWizard(false);
    setBorradorInicial(null);
    router.refresh();
  }

  return (
    <Tabs defaultValue="proveedores">
      <TabsList>
        <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        {esAdmin && <TabsTrigger value="facturas">Facturas</TabsTrigger>}
      </TabsList>

      <TabsContent value="proveedores">
        <GestionProveedores negocioId={negocioId} esAdmin={esAdmin} inicial={proveedores} />
      </TabsContent>

      {esAdmin && (
        <TabsContent value="facturas" className="space-y-4">
          {mostrarWizard ? (
            <FacturaWizard
              catalogos={catalogos}
              proveedores={proveedores}
              negocioId={negocioId}
              borradorInicial={borradorInicial}
              onListo={cerrarWizard}
            />
          ) : (
            <>
              <Button onClick={() => setMostrarWizard(true)} className="w-full h-12">
                <Plus className="mr-2 h-4 w-4" /> Registrar factura de proveedor
              </Button>

              {borradoresLista.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileClock className="h-4 w-4 text-amber-500" /> Facturas en borrador ({borradoresLista.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-border/40">
                      {borradoresLista.map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-2 p-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {b.numero_factura || "Sin número"} — {b.proveedor_nombre ?? "Sin proveedor"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {b.items_count} ítem(s) · {formatFecha(b.updated_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => continuarBorrador(b.id)}
                              disabled={cargandoBorrador === b.id}
                            >
                              {cargandoBorrador === b.id ? "Abriendo…" : "Continuar"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Descartar borrador"
                              onClick={() => descartarBorrador(b.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
          <FacturasLista
            inicial={facturas}
            proveedores={proveedores}
            esAdmin={esAdmin}
            pagosIniciales={pagos}
            negocioId={negocioId}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
