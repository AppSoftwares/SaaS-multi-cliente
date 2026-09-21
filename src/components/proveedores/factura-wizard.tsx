"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Sparkles, RotateCcw, Trash2, RefreshCw, FileCheck2, PlusCircle, PencilLine, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { comprimirYSubirFactura } from "@/lib/storage";
import { resolverCatalogos, resolverProveedor } from "@/lib/catalogos";
import { generarCodigoBarrasInterno } from "@/lib/barcode";
import { CampoNumero } from "@/components/captura/campo-numero";
import { SelectorCombo, SelectorCategoria, SelectorProveedor } from "@/components/captura/selectores";
import { EtiquetaBarcode } from "@/components/productos/etiqueta-barcode";
import { DEMO } from "@/lib/demo";
import type { Catalogos, Factura, FacturaItem, Proveedor, ResultadoProcesarFactura } from "@/lib/types";

type Vista = "form" | "procesando" | "revision" | "listo";

interface ItemEditable {
  status: "EXISTING" | "NEW";
  producto_id: string | null;
  nombre: string;
  sku: string;
  codigo_barras: string;
  cantidad: number;
  // Precio de costo de lista (antes del descuento del proveedor) y el % que
  // ese proveedor da sobre ese precio en esta factura. precio_costo (el que
  // realmente se guarda) es siempre costoLista * (1 - descuentoPct/100).
  costoLista: number;
  descuentoPct: number | "";
  precio_costo: number;
  precio_venta: number;
  utilidad_pct: number | "";
  catMadre: string;
  catSub: string;
  marca: string;
  unidad_medida: string;
  incluir: boolean;
}

type BaseGanancia = "lista" | "neto";
const CLAVE_GANANCIA = "factura_ganancia_prefs";

function leerPrefsGanancia(): { base: BaseGanancia; pct: number | "" } {
  const defecto = { base: "lista" as BaseGanancia, pct: "" as number | "" };
  if (typeof window === "undefined") return defecto;
  try {
    const raw = window.localStorage.getItem(CLAVE_GANANCIA);
    if (!raw) return defecto;
    const p = JSON.parse(raw) as { base?: string; pct?: number | "" };
    return { base: p.base === "neto" ? "neto" : "lista", pct: typeof p.pct === "number" ? p.pct : "" };
  } catch {
    return defecto;
  }
}

// Precio con ganancia, en centavos enteros (evita errores de coma flotante).
function precioConGanancia(costo: number, pct: number): number {
  return Math.round((Math.round(costo * 100) * (100 + pct)) / 100) / 100;
}

function costoConDescuento(costoLista: number, descuentoPct: number | ""): number {
  const pct = descuentoPct === "" ? 0 : Math.min(Math.max(descuentoPct, 0), 100);
  // En centavos enteros: 3.30 * 0.75 en coma flotante da 2.4749999… y
  // redondeaba a 2.47 en vez de 2.48.
  const centavos = Math.round(costoLista * 100);
  return Math.round((centavos * (100 - pct)) / 100) / 100;
}

export function FacturaWizard({
  catalogos,
  proveedores,
  negocioId,
  borradorInicial,
  onListo,
}: {
  catalogos: Catalogos;
  proveedores: Proveedor[];
  negocioId: string;
  borradorInicial?: { factura: Factura; items: FacturaItem[] } | null;
  onListo: () => void;
}) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>(borradorInicial ? "revision" : "form");
  const facturaIdRef = useRef<string | null>(borradorInicial?.factura.id ?? null);
  const guardandoBorradorRef = useRef(false);

  const [proveedorId, setProveedorId] = useState(borradorInicial?.factura.proveedor_id ?? "");
  const [proveedorNuevo, setProveedorNuevo] = useState(borradorInicial?.factura.proveedor_nombre_nuevo ?? "");
  const [imagenUrl, setImagenUrl] = useState<string | null>(borradorInicial?.factura.imagen_url ?? null);
  const [preview, setPreview] = useState<string | null>(borradorInicial?.factura.imagen_url ?? null);
  const [subiendo, setSubiendo] = useState(false);

  const [numeroFactura, setNumeroFactura] = useState(borradorInicial?.factura.numero_factura ?? "");
  const [fecha, setFecha] = useState(borradorInicial?.factura.fecha ?? "");
  const [moneda, setMoneda] = useState<"BS" | "USD">(borradorInicial?.factura.moneda ?? "BS");
  const [montoTotal, setMontoTotal] = useState(borradorInicial?.factura.monto_total ?? 0);
  const [pagada, setPagada] = useState(false);
  const [aplicarStock, setAplicarStock] = useState(true);

  const [items, setItems] = useState<ItemEditable[]>(
    (borradorInicial?.items ?? []).map((it) => ({
      status: it.producto_id ? "EXISTING" : "NEW",
      producto_id: it.producto_id,
      nombre: it.nombre,
      sku: it.sku ?? "",
      codigo_barras: it.codigo_barras ?? "",
      cantidad: it.cantidad,
      // Se retoman el costo de lista y el % de descuento guardados. En
      // borradores anteriores a esta versión solo existe el costo neto: se usa
      // como lista sin % para no inventar un descuento.
      costoLista: it.costo_lista != null ? Number(it.costo_lista) : it.precio_costo,
      descuentoPct: it.descuento_pct != null ? Number(it.descuento_pct) : "",
      precio_costo: it.precio_costo,
      precio_venta: it.precio_venta_sugerido ?? 0,
      utilidad_pct: "",
      catMadre: "",
      catSub: "",
      marca: "",
      unidad_medida: "Unidad",
      incluir: true,
    }))
  );
  const [guardando, setGuardando] = useState(false);
  // Líneas cuyo SKU/código ya existe (índice en `items` -> mensaje).
  const [conflictos, setConflictos] = useState<Record<number, string>>({});
  const limpiarConflicto = (i: number) =>
    setConflictos((c) => {
      if (!(i in c)) return c;
      const n = { ...c };
      delete n[i];
      return n;
    });
  const [creados, setCreados] = useState<{ nombre: string; codigo_barras: string }[]>([]);

  // Guarda automáticamente el progreso como borrador para que, si el usuario
  // se sale a revisar otra pantalla, pueda volver y continuar donde quedó.
  async function guardarBorrador() {
    if (DEMO || guardandoBorradorRef.current) return;
    if (items.length === 0 && !numeroFactura && !proveedorId) return;
    guardandoBorradorRef.current = true;
    try {
      const res = await fetch("/api/facturas/borrador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facturaId: facturaIdRef.current,
          factura: {
            proveedor_id: proveedorId || null,
            proveedor_nombre_nuevo: proveedorNuevo || null,
            numero_factura: numeroFactura || null,
            fecha: fecha || null,
            moneda,
            monto_total: montoTotal,
            imagen_url: imagenUrl,
          },
          items: items.map((it) => ({
            producto_id: it.producto_id,
            nombre: it.nombre,
            sku: it.sku || null,
            codigo_barras: it.codigo_barras || null,
            cantidad: it.cantidad,
            precio_costo: it.precio_costo,
            costo_lista: it.costoLista,
            descuento_pct: it.descuentoPct === "" ? null : it.descuentoPct,
            precio_venta: it.precio_venta || null,
            es_nuevo: it.status === "NEW",
          })),
        }),
      });
      const json = await res.json();
      if (res.ok && json.facturaId) facturaIdRef.current = json.facturaId;
    } catch {
      // Autosave silencioso: si falla, se reintenta en el próximo cambio.
    } finally {
      guardandoBorradorRef.current = false;
    }
  }

  // Autoguardado con debounce mientras el usuario edita la revisión.
  useEffect(() => {
    if (DEMO || vista !== "revision") return;
    const t = setTimeout(() => {
      guardarBorrador();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, numeroFactura, fecha, moneda, montoTotal, proveedorId, proveedorNuevo, vista]);

  async function cancelar() {
    if (facturaIdRef.current && !DEMO) {
      await fetch(`/api/facturas/borrador/${facturaIdRef.current}`, { method: "DELETE" }).catch(() => {});
    }
    onListo();
  }

  async function guardarYSalirDespues() {
    await guardarBorrador();
    toast.success("Guardado. Podrás continuar esta factura desde 'Facturas en borrador'.");
    onListo();
  }

  function agregarItemManual() {
    setItems((arr) => [
      ...arr,
      {
        status: "NEW",
        producto_id: null,
        nombre: "",
        sku: "",
        codigo_barras: "",
        cantidad: 1,
        costoLista: 0,
        descuentoPct: "",
        precio_costo: 0,
        precio_venta: 0,
        utilidad_pct: "",
        catMadre: "",
        catSub: "",
        marca: "",
        unidad_medida: "Unidad",
        incluir: true,
      },
    ]);
  }

  // Carga 100% manual: salta la foto y la IA, va directo a la revisión con
  // la lista de ítems vacía para que el usuario los agregue uno a uno.
  function cargarManual() {
    setVista("revision");
    if (items.length === 0) agregarItemManual();
  }

  function setItem<K extends keyof ItemEditable>(i: number, k: K, v: ItemEditable[K]) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  }

  // La ganancia puede calcularse sobre el precio de lista (sin el descuento del
  // proveedor, lo habitual: se vende sobre el precio "total") o sobre el costo
  // ya con descuento. La elección se recuerda entre facturas.
  const [baseGanancia, setBaseGanancia] = useState<BaseGanancia>(() => leerPrefsGanancia().base);
  const [gananciaGlobal, setGananciaGlobal] = useState<number | "">(() => leerPrefsGanancia().pct);
  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_GANANCIA, JSON.stringify({ base: baseGanancia, pct: gananciaGlobal }));
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }, [baseGanancia, gananciaGlobal]);

  const costoBase = (lista: number, neto: number, base: BaseGanancia = baseGanancia) =>
    base === "lista" ? lista : neto;

  // Costo base + % utilidad -> precio de venta calculado (el ADMIN ya no tiene
  // que sacar la cuenta con calculadora).
  function calcularPrecioVentaItem(i: number, costo: number, utilidad: number | "") {
    if (utilidad === "" || !(costo > 0)) return;
    setItem(i, "precio_venta", precioConGanancia(costo, utilidad));
  }

  function aplicarGananciaATodos(pct: number, base: BaseGanancia) {
    setItems((arr) =>
      arr.map((it) =>
        it.status === "NEW" && it.incluir
          ? { ...it, utilidad_pct: pct, precio_venta: precioConGanancia(costoBase(it.costoLista, it.precio_costo, base), pct) }
          : it
      )
    );
  }

  function cambiarBaseGanancia(base: BaseGanancia) {
    setBaseGanancia(base);
    setItems((arr) =>
      arr.map((it) =>
        it.status === "NEW" && it.incluir && it.utilidad_pct !== ""
          ? {
              ...it,
              precio_venta: precioConGanancia(costoBase(it.costoLista, it.precio_costo, base), Number(it.utilidad_pct)),
            }
          : it
      )
    );
  }

  // Si el código de barras o SKU que se está tipeando ya existe en el
  // catálogo, convierte la línea a EXISTING y trae categoría/marca/unidad/
  // precio de venta automáticamente (no hace falta volver a cargarlos).
  async function buscarProductoExistente(i: number) {
    const it = items[i];
    if (!it || it.status !== "NEW") return;
    const codigo = it.codigo_barras.trim();
    const sku = it.sku.trim();
    if (!codigo && !sku) return;
    if (DEMO) return;

    const params = new URLSearchParams();
    if (codigo) params.set("codigo_barras", codigo);
    if (sku) params.set("sku", sku);
    const res = await fetch(`/api/productos/buscar-barcode?${params.toString()}`);
    if (!res.ok) return;
    const json = await res.json();
    const prod = json.producto;
    if (!prod) return;

    setItems((arr) =>
      arr.map((x, idx) =>
        idx === i
          ? {
              ...x,
              status: "EXISTING" as const,
              producto_id: prod.id,
              nombre: prod.nombre,
              sku: prod.sku ?? "",
              codigo_barras: prod.codigo_barras ?? "",
              marca: prod.marca ?? "",
              unidad_medida: prod.unidad_medida,
              precio_venta: prod.precio_venta,
            }
          : x
      )
    );
    toast.success(`Producto encontrado en catálogo: ${prod.nombre}`);
  }

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setPreview(URL.createObjectURL(file));
    try {
      const url = DEMO ? URL.createObjectURL(file) : await comprimirYSubirFactura(file);
      setImagenUrl(url);
    } catch {
      toast.error("No se pudo subir la imagen");
      setPreview(null);
    } finally {
      setSubiendo(false);
    }
  }

  function cargarResultado(r: ResultadoProcesarFactura) {
    setNumeroFactura(r.numero_factura ?? "");
    setFecha(r.fecha ?? "");
    setMoneda(r.moneda);
    setMontoTotal(r.monto_total);
    setItems(
      r.items.map((it) => {
        if (it.status === "EXISTING") {
          return {
            status: "EXISTING",
            producto_id: it.producto_bd.id,
            nombre: it.producto_bd.nombre,
            sku: it.producto_bd.sku ?? "",
            codigo_barras: it.producto_bd.codigo_barras ?? "",
            cantidad: it.item_ia.cantidad,
            costoLista: it.item_ia.precio_costo,
            descuentoPct: "",
            precio_costo: it.item_ia.precio_costo,
            precio_venta: it.producto_bd.precio_venta,
            utilidad_pct: "",
            catMadre: "",
            catSub: "",
            marca: it.producto_bd.marca ?? "",
            unidad_medida: it.producto_bd.unidad_medida,
            incluir: true,
          };
        }
        return {
          status: "NEW",
          producto_id: null,
          nombre: it.item_ia.nombre,
          sku: it.item_ia.sku ?? "",
          codigo_barras: it.item_ia.codigo_barras ?? "",
          cantidad: it.item_ia.cantidad,
          costoLista: it.item_ia.precio_costo,
          descuentoPct: "",
          precio_costo: it.item_ia.precio_costo,
          precio_venta: 0,
          utilidad_pct: "",
          catMadre: "",
          catSub: "",
          marca: "",
          unidad_medida: "Unidad",
          incluir: true,
        };
      })
    );
    if (proveedorId === "" && !proveedorNuevo && r.proveedor_nombre) {
      const match = proveedores.find((p) => p.nombre.toLowerCase() === r.proveedor_nombre!.trim().toLowerCase());
      if (match) setProveedorId(match.id);
      else setProveedorNuevo(r.proveedor_nombre);
    }
  }

  async function procesar() {
    if (!imagenUrl) {
      toast.error("Toma o sube la foto de la factura");
      return;
    }
    setVista("procesando");

    if (DEMO) {
      await new Promise((r) => setTimeout(r, 900));
      cargarResultado({
        numero_factura: "F-00123",
        fecha: new Date().toISOString().slice(0, 10),
        proveedor_nombre: "Bosch",
        moneda: "USD",
        monto_total: 245.5,
        items: [
          {
            status: "NEW",
            item_ia: { nombre: "Disco de corte 4.5\"", sku: null, codigo_barras: null, cantidad: 20, precio_costo: 1.8 },
          },
        ],
      });
      setVista("revision");
      return;
    }

    const res = await fetch("/api/facturas/procesar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagenUrl }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Error al procesar la factura");
      setVista("form");
      return;
    }
    cargarResultado(json as ResultadoProcesarFactura);
    setVista("revision");
    guardarBorrador();
  }

  async function confirmar() {
    const activos = items.filter((it) => it.incluir);
    if (activos.length === 0) {
      toast.error("No hay ítems para registrar");
      return;
    }

    if (DEMO) {
      toast.success("(Demo) Factura registrada");
      setVista("listo");
      return;
    }

    // Las líneas deben sumar el total de la factura: si no, casi siempre es una
    // línea perdida o una cantidad mal leída. Es una advertencia (el total puede
    // incluir IVA u otros cargos), no un bloqueo.
    // El total impreso puede ser a costo de lista (antes de los descuentos por
    // producto) o ya con descuento: se acepta si cualquiera de las dos cuadra.
    const sumaNeta = activos.reduce((s, it) => s + it.cantidad * it.precio_costo, 0);
    const sumaLista = activos.reduce((s, it) => s + it.cantidad * it.costoLista, 0);
    const hayDescuentos = activos.some((it) => it.descuentoPct !== "" && it.descuentoPct > 0);
    const tolerancia = Math.max(0.5, montoTotal * 0.01);
    const cuadra = Math.abs(sumaNeta - montoTotal) <= tolerancia || Math.abs(sumaLista - montoTotal) <= tolerancia;
    if (montoTotal > 0 && !cuadra) {
      const detalle = hayDescuentos
        ? `A costo de lista las líneas suman ${sumaLista.toFixed(2)} ${moneda} y con los descuentos por producto ${sumaNeta.toFixed(2)} ${moneda}`
        : `Las líneas suman ${sumaNeta.toFixed(2)} ${moneda}`;
      const seguir = window.confirm(
        `${detalle}, pero el total de la factura es ${montoTotal.toFixed(2)} ${moneda}.\n\nRevisa que no falte ningún producto, que las cantidades y costos estén bien y, si la factura tiene un descuento general, que el total refleje ese descuento.\n\n¿Registrar la factura de todos modos?`
      );
      if (!seguir) return;
    }

    setConflictos({});
    setGuardando(true);
    const prov = await resolverProveedor(negocioId, proveedores, { proveedorId, nombreNuevo: proveedorNuevo });

    const itemsPayload = [];
    for (const it of activos) {
      if (it.status === "EXISTING") {
        itemsPayload.push({
          status: "EXISTING" as const,
          producto_id: it.producto_id,
          nombre: it.nombre,
          sku: it.sku || null,
          codigo_barras: it.codigo_barras || null,
          cantidad: it.cantidad,
          precio_costo: it.precio_costo,
          costo_lista: it.costoLista,
          descuento_pct: it.descuentoPct === "" ? null : it.descuentoPct,
          aplicar_stock: aplicarStock,
        });
      } else {
        const cat = await resolverCatalogos(negocioId, catalogos, {
          madre: it.catMadre,
          sub: it.catSub,
          marca: it.marca,
          unidad: it.unidad_medida,
        });
        itemsPayload.push({
          status: "NEW" as const,
          nombre: it.nombre,
          sku: it.sku || null,
          codigo_barras: it.codigo_barras || null,
          categoria: cat.categoria,
          categoria_id: cat.categoria_id,
          marca: cat.marca,
          unidad_medida: cat.unidad_medida,
          cantidad: it.cantidad,
          precio_costo: it.precio_costo,
          costo_lista: it.costoLista,
          descuento_pct: it.descuentoPct === "" ? null : it.descuentoPct,
          precio_venta: it.precio_venta,
          aplicar_stock: aplicarStock,
        });
      }
    }

    const res = await fetch("/api/facturas/aplicar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facturaId: facturaIdRef.current,
        factura: {
          proveedor_id: prov.proveedor_id,
          numero_factura: numeroFactura || null,
          fecha: fecha || null,
          moneda,
          monto_total: montoTotal,
          pagada,
          imagen_url: imagenUrl,
        },
        items: itemsPayload,
      }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!res.ok) {
      if (res.status === 409 && Array.isArray(json.conflictos)) {
        const globales = items.map((it, i) => (it.incluir ? i : -1)).filter((i) => i >= 0);
        const mapa: Record<number, string> = {};
        for (const c of json.conflictos as { idx: number; campo: string; valor: string; con: string }[]) {
          const g = globales[c.idx];
          if (g === undefined) continue;
          const campo = c.campo === "sku" ? "El SKU" : "El código de barras";
          mapa[g] = `${campo} “${c.valor}” ya lo tiene ${c.con}. Cámbialo, o si es el mismo producto usa “No es este / ya existe”.`;
        }
        setConflictos(mapa);
      }
      toast.error(json.error ?? "Error al registrar la factura", { duration: 10000 });
      return;
    }
    const fallidos: { nombre: string; error: string }[] = json.fallidos ?? [];
    if (fallidos.length > 0) {
      toast.error(
        `La factura se registró, pero NO se pudo crear: ${fallidos.map((f) => `${f.nombre} (${f.error})`).join("; ")}`,
        { duration: 20000 }
      );
    }
    setCreados(json.creados ?? []);
    toast.success("Factura registrada");
    const alertas: { nombre: string; costo_anterior: number; costo_nuevo: number; pct: number }[] =
      json.alertas_costo ?? [];
    for (const a of alertas) {
      toast.warning(
        `⚠️ Subió el costo de "${a.nombre}": $${a.costo_anterior.toFixed(2)} → $${a.costo_nuevo.toFixed(2)} (+${a.pct}%)`,
        { duration: 8000 }
      );
    }
    router.refresh();
    setVista("listo");
  }

  // Resumen de descuentos por producto para mostrar en la revisión.
  const lineasActivas = items.filter((it) => it.incluir);
  const totalLista = Math.round(lineasActivas.reduce((s, it) => s + it.cantidad * it.costoLista, 0) * 100) / 100;
  const totalNeto = Math.round(lineasActivas.reduce((s, it) => s + it.cantidad * it.precio_costo, 0) * 100) / 100;
  const hayDescuentosVista = lineasActivas.some((it) => it.descuentoPct !== "" && it.descuentoPct > 0);

  if (vista === "form") {
    return (
      <div className="glass rounded-2xl p-4 space-y-4 animate-in-up">
        <h3 className="font-bold flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-primary" /> Nueva factura de proveedor
        </h3>

        <SelectorProveedor
          proveedores={proveedores}
          proveedorId={proveedorId}
          nombreNuevo={proveedorNuevo}
          onChange={(id, nuevo) => {
            setProveedorId(id);
            setProveedorNuevo(nuevo);
          }}
        />

        <label className="block">
          <div className="flex items-center justify-center h-44 rounded-xl border-2 border-dashed bg-muted/30 overflow-hidden relative cursor-pointer">
            {preview ? (
              <Image src={preview} alt="Vista previa" fill className="object-cover" unoptimized />
            ) : (
              <div className="text-center text-muted-foreground">
                <Camera className="h-8 w-8 mx-auto mb-1" />
                <span className="text-sm">{subiendo ? "Subiendo…" : "Toca para fotografiar la factura"}</span>
              </div>
            )}
          </div>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={elegirFoto} />
        </label>

        <div className="flex gap-2">
          <Button variant="outline" onClick={cancelar} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={procesar} disabled={subiendo || !imagenUrl} className="flex-1">
            <Sparkles className="mr-2 h-4 w-4" /> Analizar con IA
          </Button>
        </div>
        <button
          type="button"
          onClick={cargarManual}
          className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 flex items-center justify-center gap-1"
        >
          <PencilLine className="h-3.5 w-3.5" /> No puedo tomar la foto, cargar los productos manualmente
        </button>
      </div>
    );
  }

  if (vista === "procesando") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Sparkles className="h-8 w-8 animate-pulse mb-2" />
        <p>Leyendo la factura…</p>
      </div>
    );
  }

  if (vista === "listo") {
    return (
      <div className="glass rounded-2xl p-4 space-y-4 animate-in-up">
        <h3 className="font-bold text-brand-cyan">Factura registrada</h3>
        {creados.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Productos nuevos creados — imprime la etiqueta y pégala al producto:
            </p>
            <div className="flex flex-wrap gap-3">
              {creados.map((c) => (
                <EtiquetaBarcode key={c.codigo_barras} nombre={c.nombre} codigo={c.codigo_barras} />
              ))}
            </div>
          </div>
        )}
        <Button onClick={onListo} className="w-full">
          <RotateCcw className="mr-2 h-4 w-4" /> Registrar otra factura
        </Button>
      </div>
    );
  }

  // --- revisión ---
  return (
    <div className="glass rounded-2xl p-4 space-y-4 animate-in-up">
      <h3 className="font-bold flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" /> Revisa los datos extraídos
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>N° de factura</Label>
          <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Moneda</Label>
          <Select value={moneda} onValueChange={(v) => v && setMoneda(v as "BS" | "USD")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BS">Bs</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Monto total</Label>
          <CampoNumero value={montoTotal} onValor={(v) => setMontoTotal(Number(v) || 0)} />
        </div>
      </div>

      {hayDescuentosVista && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs space-y-2">
          <p>
            A costo de lista las líneas suman <b>{totalLista.toFixed(2)}</b> {moneda}; con los descuentos por producto,{" "}
            <b>{totalNeto.toFixed(2)}</b> {moneda}.
          </p>
          {Math.abs(montoTotal - totalNeto) > 0.005 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Si la factura impresa muestra los precios de lista, lo que realmente se paga es el total con descuentos.
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => setMontoTotal(totalNeto)}>
                Usar {totalNeto.toFixed(2)} como total
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={pagada} onCheckedChange={(v) => setPagada(!!v)} /> ¿Factura pagada?
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={aplicarStock} onCheckedChange={(v) => setAplicarStock(!!v)} /> Ajustar stock de inventario
        </label>
      </div>

      {items.some((it) => it.status === "NEW" && it.incluir) && (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-medium">Ganancia para el precio de venta</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                ["lista", "Sobre el precio de lista (sin descuento)"],
                ["neto", "Sobre el costo con descuento"],
              ] as const
            ).map(([base, texto]) => (
              <button
                key={base}
                type="button"
                onClick={() => cambiarBaseGanancia(base)}
                className={`rounded-full border px-3 py-1 font-medium transition-colors ${
                  baseGanancia === base
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label>% de ganancia para todos los productos nuevos</Label>
              <CampoNumero permitirVacio placeholder="Ej: 30" value={gananciaGlobal} onValor={setGananciaGlobal} />
            </div>
            <Button
              type="button"
              disabled={gananciaGlobal === "" || Number(gananciaGlobal) <= 0}
              onClick={() => aplicarGananciaATodos(Number(gananciaGlobal), baseGanancia)}
            >
              Aplicar a todos
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Después puedes ajustar el % o el precio de cada línea a mano.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Contador de ítem: para no perder la cuenta al cargar
                    facturas largas (15-20 productos) ítem a ítem. */}
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  Ítem {i + 1} de {items.length}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    it.status === "EXISTING" ? "bg-brand-cyan/20 text-brand-cyan" : "bg-primary/20 text-primary"
                  }`}
                >
                  {it.status === "EXISTING" ? "Ya existe" : "Producto nuevo"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {it.status === "EXISTING" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setItems((arr) =>
                        arr.map((x, idx) =>
                          idx === i ? { ...x, status: "NEW", producto_id: null, precio_venta: 0 } : x
                        )
                      )
                    }
                  >
                    No es este, crear nuevo
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar de la factura"
                  onClick={() => setItem(i, "incluir", !it.incluir)}
                >
                  <Trash2 className={`h-4 w-4 ${it.incluir ? "text-destructive" : "text-muted-foreground"}`} />
                </Button>
              </div>
            </div>

            {conflictos[i] && (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                {conflictos[i]}
              </p>
            )}
            {!it.incluir ? (
              <p className="text-sm text-muted-foreground italic">Excluido de la factura</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label>Nombre</Label>
                  <Input value={it.nombre} onChange={(e) => setItem(i, "nombre", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Cantidad</Label>
                  <CampoNumero entero value={it.cantidad} onValor={(v) => setItem(i, "cantidad", Number(v) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label>Precio costo {it.descuentoPct !== "" && it.descuentoPct > 0 ? "(lista)" : ""}</Label>
                  <CampoNumero
                    value={it.costoLista}
                    onValor={(v) => {
                      const costoLista = Number(v) || 0;
                      const neto = costoConDescuento(costoLista, it.descuentoPct);
                      setItem(i, "costoLista", costoLista);
                      setItem(i, "precio_costo", neto);
                      if (it.status === "NEW") calcularPrecioVentaItem(i, costoBase(costoLista, neto), it.utilidad_pct);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Descuento del proveedor (%)</Label>
                  <CampoNumero
                    permitirVacio
                    placeholder="Ej: 25"
                    value={it.descuentoPct}
                    onValor={(descuentoPct) => {
                      const neto = costoConDescuento(it.costoLista, descuentoPct);
                      setItem(i, "descuentoPct", descuentoPct);
                      setItem(i, "precio_costo", neto);
                      if (it.status === "NEW") calcularPrecioVentaItem(i, costoBase(it.costoLista, neto), it.utilidad_pct);
                    }}
                  />
                </div>
                {it.descuentoPct !== "" && it.descuentoPct > 0 && (
                  <div className="col-span-2 -mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    Costo con descuento: {it.precio_costo.toFixed(2)}
                  </div>
                )}
                <div className="space-y-1">
                  <Label>SKU</Label>
                  <Input
                    value={it.sku}
                    onChange={(e) => {
                      setItem(i, "sku", e.target.value);
                      limpiarConflicto(i);
                    }}
                    onBlur={() => it.status === "NEW" && buscarProductoExistente(i)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Código de barras</Label>
                  <div className="flex gap-1">
                    <Input
                      className="flex-1"
                      value={it.codigo_barras}
                      onChange={(e) => {
                        setItem(i, "codigo_barras", e.target.value);
                        limpiarConflicto(i);
                      }}
                      onBlur={() => it.status === "NEW" && buscarProductoExistente(i)}
                      placeholder={it.status === "NEW" ? "Se genera si lo dejas vacío" : ""}
                    />
                    {it.status === "NEW" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Generar código"
                        onClick={() => setItem(i, "codigo_barras", generarCodigoBarrasInterno())}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {it.status === "NEW" && (
                  <>
                    <SelectorCategoria
                      categorias={catalogos.categorias}
                      madre={it.catMadre}
                      sub={it.catSub}
                      onChange={(m, s) => {
                        setItem(i, "catMadre", m);
                        setItem(i, "catSub", s);
                      }}
                    />
                    <SelectorCombo
                      label="Marca"
                      opciones={catalogos.marcas.map((m) => m.nombre)}
                      value={it.marca}
                      onChange={(v) => setItem(i, "marca", v)}
                    />
                    <SelectorCombo
                      label="Unidad"
                      opciones={catalogos.unidades.map((u) => u.nombre)}
                      value={it.unidad_medida}
                      onChange={(v) => setItem(i, "unidad_medida", v)}
                    />
                    <div className="space-y-1">
                      <Label>% Utilidad ({baseGanancia === "lista" ? "sobre lista" : "sobre costo c/desc."})</Label>
                      <CampoNumero
                        permitirVacio
                        placeholder="Ej: 30"
                        value={it.utilidad_pct}
                        onValor={(pct) => {
                          setItem(i, "utilidad_pct", pct);
                          calcularPrecioVentaItem(i, costoBase(it.costoLista, it.precio_costo), pct);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Precio venta (USD)</Label>
                      <CampoNumero value={it.precio_venta} onValor={(v) => setItem(i, "precio_venta", Number(v) || 0)} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={agregarItemManual} className="w-full">
        <PlusCircle className="mr-2 h-4 w-4" /> Agregar producto manualmente
      </Button>

      <div className="flex gap-2">
        <Button variant="outline" onClick={cancelar} className="flex-1">
          Cancelar
        </Button>
        <Button variant="secondary" onClick={guardarYSalirDespues} disabled={guardando} className="flex-1">
          <Save className="mr-2 h-4 w-4" /> Guardar y continuar después
        </Button>
      </div>
      <Button onClick={confirmar} disabled={guardando} className="w-full">
        {guardando ? "Guardando…" : "Registrar factura"}
      </Button>
    </div>
  );
}
