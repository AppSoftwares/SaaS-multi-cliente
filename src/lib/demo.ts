// ---------------------------------------------------------------------------
// MODO DEMO — permite ver y navegar la interfaz SIN base de datos.
// Se activa con NEXT_PUBLIC_DEMO=1. Todos los datos son de ejemplo (no persisten).
// Para quitarlo en producción: busca "DEMO" en el código.
// ---------------------------------------------------------------------------
import type { Producto, Movimiento, KpisDashboard, Catalogos } from "@/lib/types";
import type { SesionUsuario } from "@/lib/auth";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

// Tasas de ejemplo para el modo demo
export const DEMO_BCV = 639.7;
export const DEMO_BINANCE = 737;

export const demoSesion: SesionUsuario = {
  userId: "demo-user",
  email: "demo@ferreteria.com",
  negocioId: "demo-negocio",
  rol: "ADMIN",
};

export const demoProductos: Producto[] = [
  mk("p1", "Taladro percutor 750W", "Herramientas eléctricas", 8, 3, 89.9, 55, {
    sku: "TAL-750", codigo_barras: "7501234500011", proveedor: "Bosch", ubicacion: "Pasillo 3 - A2", unidad: "unidad",
  }),
  mk("p2", "Tornillo hexagonal 1/4\" (caja 100)", "Tornillería", 2, 5, 6.5, 3.2, {
    sku: "TOR-14-100", codigo_barras: "7501234500028", proveedor: "Hilti", ubicacion: "Pasillo 1 - B4", unidad: "caja",
  }),
  mk("p3", "Cemento gris 50kg", "Construcción", 40, 10, 12.75, 9.1, {
    sku: "CEM-50", codigo_barras: "7501234500035", proveedor: "Cemex", ubicacion: "Bodega", unidad: "saco",
  }),
  mk("p4", "Pintura vinílica blanca 1 galón", "Pinturas", 1, 4, 24.0, 15.5, {
    sku: "PIN-BL-1G", codigo_barras: "7501234500042", proveedor: "Comex", ubicacion: "Pasillo 5 - C1", unidad: "galón",
  }),
  mk("p5", "Cable THW #12 (metro)", "Eléctrico", 320, 100, 0.85, 0.55, {
    sku: "CAB-12", codigo_barras: "7501234500059", proveedor: "Condumex", ubicacion: "Pasillo 4 - A1", unidad: "metro",
  }),
  mk("p6", "Llave inglesa 10\"", "Herramientas manuales", 15, 5, 14.9, 8.0, {
    sku: "LLA-10", codigo_barras: "7501234500066", proveedor: "Truper", ubicacion: "Pasillo 2 - D3", unidad: "unidad",
  }),
];

export const demoMovimientos: Movimiento[] = [
  mmov("m1", "p3", "INGRESO", 20, 40),
  mmov("m2", "p1", "VENTA", -2, 8),
  mmov("m3", "p2", "AJUSTE", -1, 2),
  mmov("m4", "p5", "ALTA", 320, 320),
  mmov("m5", "p4", "VENTA", -3, 1),
];

export const demoCatalogos: Catalogos = {
  categorias: [
    { id: "m1", nombre: "Herramientas", parent_id: null },
    { id: "m1a", nombre: "Manuales", parent_id: "m1" },
    { id: "m1b", nombre: "Eléctricas", parent_id: "m1" },
    { id: "m2", nombre: "Construcción", parent_id: null },
    { id: "m2a", nombre: "Cemento", parent_id: "m2" },
    { id: "m3", nombre: "Pinturas", parent_id: null },
    { id: "m3a", nombre: "Interiores", parent_id: "m3" },
    { id: "m4", nombre: "Eléctrico", parent_id: null },
    { id: "m4a", nombre: "Cables", parent_id: "m4" },
    { id: "m5", nombre: "Hogar", parent_id: null },
  ],
  marcas: [
    { id: "b1", nombre: "Genérica" },
    { id: "b2", nombre: "Truper" },
    { id: "b3", nombre: "Stanley" },
    { id: "b4", nombre: "Bosch" },
  ],
  unidades: [
    { id: "u1", nombre: "Unidad" },
    { id: "u2", nombre: "Caja" },
    { id: "u3", nombre: "Galón" },
    { id: "u4", nombre: "Metro" },
    { id: "u5", nombre: "Kilogramo" },
    { id: "u6", nombre: "Saco" },
  ],
};

export const demoKpis: KpisDashboard = {
  total_productos: demoProductos.length,
  bajo_stock: demoProductos.filter((p) => p.stock_minimo > 0 && p.cantidad <= p.stock_minimo).length,
  valor_inventario_venta: demoProductos.reduce((s, p) => s + p.cantidad * p.precio_venta, 0),
  valor_inventario_costo: demoProductos.reduce((s, p) => s + p.cantidad * (p.precio_costo ?? 0), 0),
};

function mk(
  id: string,
  nombre: string,
  categoria: string,
  cantidad: number,
  stock_minimo: number,
  precio_venta: number,
  precio_costo: number,
  extra: {
    sku: string;
    codigo_barras: string;
    proveedor: string;
    ubicacion: string;
    unidad: string;
    marca?: string;
  }
): Producto {
  return {
    id,
    negocio_id: "demo-negocio",
    sku: extra.sku,
    codigo_barras: extra.codigo_barras,
    nombre,
    descripcion: null,
    categoria,
    categoria_id: null,
    marca: extra.marca ?? "Genérica",
    unidad_medida: extra.unidad,
    cantidad,
    stock_minimo,
    precio_venta,
    imagen_url: null,
    proveedor: extra.proveedor,
    ubicacion: extra.ubicacion,
    created_by: "demo-user",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    precio_venta_bs: Math.round(precio_venta * DEMO_BINANCE * 100) / 100,
    precio_venta_usd_ajustado: Math.round((precio_venta * DEMO_BINANCE) / DEMO_BCV * 100) / 100,
    precio_costo,
  };
}

function mmov(
  id: string,
  producto_id: string,
  tipo: Movimiento["tipo"],
  cantidad_afectada: number,
  cantidad_resultante: number
): Movimiento {
  return {
    id,
    negocio_id: "demo-negocio",
    producto_id,
    tipo,
    cantidad_afectada,
    cantidad_resultante,
    usuario_id: "demo-user",
    nota: "Movimiento de ejemplo",
    created_at: new Date(Date.now() - Math.random() * 6e8).toISOString(),
  };
}
