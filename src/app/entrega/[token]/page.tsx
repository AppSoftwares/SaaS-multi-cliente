import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmarEntrega } from "@/components/entrega/confirmar-entrega";
import { DEMO, demoEntregaItems } from "@/lib/demo";
import { Package } from "lucide-react";

interface FacturaItemFila {
  id: string;
  nombre: string;
  cantidad: number;
  aplicado: boolean;
  productos: { unidad_medida: string } | null;
}

export default async function EntregaFacturaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (DEMO) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Confirmar entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Factura F-00098 · Bosch · (Demo)
              </p>
              <ul className="divide-y divide-border/40">
                {demoEntregaItems.map((it) => (
                  <li key={it.id} className="py-2 flex items-center justify-between text-sm">
                    <span className="truncate pr-2">{it.nombre}</span>
                    <span className="font-medium shrink-0">
                      {it.cantidad} {it.unidad_medida}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <ConfirmarEntrega token={token} yaEntregado={false} />
        </div>
      </div>
    );
  }

  const admin = createAdminClient();

  const { data: factura } = await admin
    .from("facturas")
    .select("id, numero_factura, fecha, entregado, proveedores(nombre)")
    .eq("token_entrega", token)
    .maybeSingle();

  if (!factura) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Enlace no válido o factura no encontrada.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: items } = await admin
    .from("factura_items")
    .select("id, nombre, cantidad, aplicado, productos(unidad_medida)")
    .eq("factura_id", factura.id);

  const filas = (items ?? []) as unknown as FacturaItemFila[];
  const proveedorNombre = (factura as unknown as { proveedores?: { nombre: string } | null }).proveedores?.nombre;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Confirmar entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Factura {factura.numero_factura || "sin número"}
              {proveedorNombre ? ` · ${proveedorNombre}` : ""}
              {factura.fecha ? ` · ${factura.fecha}` : ""}
            </p>
            <ul className="divide-y divide-border/40">
              {filas.map((it) => (
                <li key={it.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{it.nombre}</span>
                  <span className="font-medium shrink-0">
                    {it.cantidad} {it.productos?.unidad_medida ?? ""}
                  </span>
                </li>
              ))}
              {filas.length === 0 && (
                <li className="py-2 text-sm text-muted-foreground">Sin ítems registrados.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <ConfirmarEntrega token={token} yaEntregado={!!factura.entregado} />
      </div>
    </div>
  );
}
