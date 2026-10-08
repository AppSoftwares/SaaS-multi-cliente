"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus, ShoppingCart, X, MessageCircle } from "lucide-react";
import { linkWhatsApp } from "@/lib/whatsapp";
import { WA_PEDIDOS } from "@/lib/tienda-config";
import type { ProductoTienda } from "@/lib/types";

const STORAGE_KEY = "joel_tienda_carrito";
const METODOS_PAGO = ["Efectivo ($)", "Pago móvil", "Zelle", "Binance (USDT)"] as const;
const METODOS_ENTREGA = ["Retiro en tienda", "Delivery"] as const;

interface ItemCarrito {
  id: string;
  nombre: string;
  precio_usd: number;
  cantidad: number;
}

type Paso = "tienda" | "carrito" | "datos" | "listo";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function TiendaPublica({ productos }: { productos: ProductoTienda[] }) {
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [paso, setPaso] = useState<Paso>("tienda");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [metodoPago, setMetodoPago] = useState<string>("");
  const [metodoEntrega, setMetodoEntrega] = useState<string>("");
  const [nota, setNota] = useState("");
  const [mensajeFinal, setMensajeFinal] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCarrito(JSON.parse(raw));
    } catch {
      /* sin localStorage: seguimos con el carrito vacío */
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(carrito));
    } catch {
      /* ignorar */
    }
  }, [carrito, hidratado]);

  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria).filter((c): c is string => !!c))],
    [productos]
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!categoria || p.categoria === categoria) &&
        (!q || p.nombre.toLowerCase().includes(q) || (p.descripcion ?? "").toLowerCase().includes(q))
    );
  }, [productos, categoria, busqueda]);

  function cantidadEnCarrito(id: string) {
    return carrito.find((i) => i.id === id)?.cantidad ?? 0;
  }

  function cambiarCantidad(p: ProductoTienda, delta: number) {
    setCarrito((prev) => {
      const actual = prev.find((i) => i.id === p.id);
      const nueva = Math.max(0, (actual?.cantidad ?? 0) + delta);
      if (nueva === 0) return prev.filter((i) => i.id !== p.id);
      if (actual) return prev.map((i) => (i.id === p.id ? { ...i, cantidad: nueva } : i));
      return [...prev, { id: p.id, nombre: p.nombre, precio_usd: p.precio_usd, cantidad: nueva }];
    });
  }

  const total = carrito.reduce((a, i) => a + i.precio_usd * i.cantidad, 0);
  const nItems = carrito.reduce((a, i) => a + i.cantidad, 0);

  function construirMensaje() {
    const lineas = carrito.map((i) => `${i.cantidad} x ${i.nombre} — ${money(i.precio_usd * i.cantidad)}`);
    const partes = [
      "Hola, quiero consultar este pedido en Joel Ferretería:",
      "",
      ...lineas,
      "",
      `Total estimado: ${money(total)}`,
      "",
      nombreCliente.trim() && `Nombre: ${nombreCliente.trim()}`,
      metodoEntrega && `Entrega: ${metodoEntrega}${metodoEntrega === "Delivery" && direccion.trim() ? ` — ${direccion.trim()}` : ""}`,
      metodoPago && `Método de pago: ${metodoPago}`,
      nota.trim() && `Nota: ${nota.trim()}`,
      "",
      "¿Me confirman disponibilidad y el total final?",
    ].filter(Boolean) as string[];
    return partes.join("\n");
  }

  function irADatos() {
    if (carrito.length === 0) return;
    setPaso("datos");
  }

  function confirmarPedido() {
    const msg = construirMensaje();
    setMensajeFinal(msg);
    setPaso("listo");
  }

  function abrirWhatsApp() {
    window.open(linkWhatsApp(mensajeFinal, WA_PEDIDOS || undefined), "_blank", "noopener,noreferrer");
  }

  function nuevoPedido() {
    setCarrito([]);
    setNombreCliente("");
    setTelefono("");
    setDireccion("");
    setMetodoPago("");
    setMetodoEntrega("");
    setNota("");
    setPaso("tienda");
  }

  // --- Paso 3: pedido listo para WhatsApp ---
  if (paso === "listo") {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <MessageCircle className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-neutral-900">Tu pedido está listo</h2>
        <p className="mt-1 text-sm text-neutral-500">Revisa el mensaje y envíalo desde WhatsApp.</p>
        <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Resumen para WhatsApp</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-neutral-800">{mensajeFinal}</pre>
        </div>
        <p className="mt-3 text-xs text-neutral-500">La tienda confirmará disponibilidad y el total final por WhatsApp.</p>
        <button
          type="button"
          onClick={abrirWhatsApp}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98]"
        >
          <MessageCircle className="h-5 w-5" /> Abrir WhatsApp
        </button>
        <button
          type="button"
          onClick={nuevoPedido}
          className="mt-3 w-full rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700"
        >
          Volver a la tienda
        </button>
      </div>
    );
  }

  // --- Paso 2: datos del cliente ---
  if (paso === "datos") {
    return (
      <div className="mx-auto max-w-md px-4 py-6 pb-28">
        <button type="button" onClick={() => setPaso("carrito")} className="text-sm font-medium text-neutral-500">
          ← Volver al carrito
        </button>
        <h2 className="mt-2 text-xl font-extrabold text-neutral-900">Completa tu pedido</h2>

        <div className="mt-4 space-y-4">
          <Campo label="Nombre">
            <input
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="¿Cómo te llamas?"
            />
          </Campo>
          <Campo label="Teléfono (opcional)">
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              inputMode="tel"
              placeholder="04xx-xxxxxxx"
            />
          </Campo>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-neutral-700">Entrega</p>
            <div className="flex flex-wrap gap-2">
              {METODOS_ENTREGA.map((m) => (
                <Chip key={m} activo={metodoEntrega === m} onClick={() => setMetodoEntrega(m)}>
                  {m}
                </Chip>
              ))}
            </div>
          </div>
          {metodoEntrega === "Delivery" && (
            <Campo label="Dirección de entrega">
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Barrio, calle, referencia"
              />
            </Campo>
          )}

          <div>
            <p className="mb-1.5 text-sm font-semibold text-neutral-700">Método de pago</p>
            <div className="flex flex-wrap gap-2">
              {METODOS_PAGO.map((m) => (
                <Chip key={m} activo={metodoPago === m} onClick={() => setMetodoPago(m)}>
                  {m}
                </Chip>
              ))}
            </div>
          </div>

          <Campo label="Nota para la tienda (opcional)">
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 min-h-20 resize-none"
              placeholder="¿Algo que debamos saber?"
            />
          </Campo>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-4 text-base font-bold text-neutral-900">
          <span>Total estimado</span>
          <span>{money(total)}</span>
        </div>
        <button
          type="button"
          onClick={confirmarPedido}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98]"
        >
          <MessageCircle className="h-5 w-5" /> Enviar pedido por WhatsApp
        </button>
        <p className="mt-2 text-center text-[11px] text-neutral-500">
          Se abre WhatsApp con tu pedido ya escrito. Confirmamos disponibilidad, pago y entrega por ahí.
        </p>
      </div>
    );
  }

  // --- Paso 1: tienda (catálogo) + carrito (hoja inferior) ---
  return (
    <div className="pb-28">
      <div className="sticky top-[57px] z-20 -mx-4 mb-4 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-2.5 sm:top-[65px]">
        <div className="flex gap-2">
          <Chip activo={categoria === null} onClick={() => setCategoria(null)}>
            Todos
          </Chip>
          {categorias.map((c) => (
            <Chip key={c} activo={categoria === c} onClick={() => setCategoria(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-10 text-center">
          <Package className="mx-auto h-8 w-8 text-neutral-400" />
          <p className="mt-2 font-semibold text-neutral-700">No encontramos productos con ese filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibles.map((p) => (
            <TarjetaProducto key={p.id} producto={p} cantidad={cantidadEnCarrito(p.id)} onCambiar={(d) => cambiarCantidad(p, d)} />
          ))}
        </div>
      )}

      {nItems > 0 && paso === "tienda" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <button type="button" onClick={() => setPaso("carrito")} className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
              <ShoppingCart className="h-5 w-5 text-orange-600" />
              {nItems} {nItems === 1 ? "unidad" : "unidades"} · {money(total)}
            </button>
            <button
              type="button"
              onClick={() => setPaso("carrito")}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-600/30 active:scale-[0.98]"
            >
              Ver carrito →
            </button>
          </div>
        </div>
      )}

      {paso === "carrito" && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setPaso("tienda")}>
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h2 className="text-lg font-extrabold text-neutral-900">Mi carrito</h2>
              <button type="button" onClick={() => setPaso("tienda")} aria-label="Cerrar" className="text-neutral-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            {carrito.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">Tu carrito está vacío.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {carrito.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{i.nombre}</p>
                      <p className="text-xs text-neutral-500">{money(i.precio_usd)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCarrito((prev) => prev.map((x) => (x.id === i.id ? { ...x, cantidad: Math.max(0, x.cantidad - 1) } : x)).filter((x) => x.cantidad > 0))}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300"
                        aria-label="Restar"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{i.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => setCarrito((prev) => prev.map((x) => (x.id === i.id ? { ...x, cantidad: x.cantidad + 1 } : x)))}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300"
                        aria-label="Sumar"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="w-16 text-right text-sm font-bold text-neutral-900">{money(i.precio_usd * i.cantidad)}</p>
                  </li>
                ))}
              </ul>
            )}
            {carrito.length > 0 && (
              <>
                <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-bold text-neutral-900">
                  <span>Total estimado</span>
                  <span>{money(total)}</span>
                </div>
                <button
                  type="button"
                  onClick={irADatos}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-600/30 active:scale-[0.98]"
                >
                  Continuar
                </button>
              </>
            )}
            <button type="button" onClick={() => setPaso("tienda")} className="mt-2 w-full py-2 text-center text-sm font-medium text-neutral-500">
              Seguir comprando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
        activo ? "border-orange-600 bg-orange-600 text-white" : "border-neutral-300 text-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function TarjetaProducto({
  producto,
  cantidad,
  onCambiar,
}: {
  producto: ProductoTienda;
  cantidad: number;
  onCambiar: (delta: number) => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="relative aspect-square w-full bg-neutral-100">
        {producto.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={producto.imagen_url} alt={producto.nombre} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-300">
            <Package className="h-10 w-10" />
          </div>
        )}
        {producto.categoria && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 shadow-sm">
            {producto.categoria}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="line-clamp-2 min-h-[2.5em] text-xs font-semibold text-neutral-800 sm:text-sm">{producto.nombre}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm font-extrabold text-neutral-900 sm:text-base">{money(producto.precio_usd)}</span>
          {cantidad === 0 ? (
            <button
              type="button"
              onClick={() => onCambiar(1)}
              className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2.5 py-1.5 text-[11px] font-semibold text-white active:scale-95 sm:text-xs"
            >
              <Plus className="h-3 w-3" /> Agregar
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onCambiar(-1)} className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300" aria-label="Restar">
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-4 text-center text-xs font-semibold">{cantidad}</span>
              <button type="button" onClick={() => onCambiar(1)} className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300" aria-label="Sumar">
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
