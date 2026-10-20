// ---------------------------------------------------------------------------
// MODO DEMO — permite ver y navegar la interfaz SIN base de datos.
// Se activa con NEXT_PUBLIC_DEMO=1. Todos los datos son de ejemplo (no persisten).
// Para quitarlo en producción: busca "DEMO" en el código.
// ---------------------------------------------------------------------------
import type {
  Producto,
  Movimiento,
  KpisDashboard,
  Catalogos,
  Proveedor,
  MetodoPago,
  CierreCaja,
  ClientePos,
  Factura,
  TurnoCaja,
  EstadoCajaVendedor,
  HistorialTurno,
  ArqueoTurno,
  FinanzasPeriodo,
  SaldoCreditoCliente,
  DetalleCreditoCliente,
  VentaDelDia,
  ClientesAnalytics,
  Campana,
} from "@/lib/types";
import type { SesionUsuario } from "@/lib/auth";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export const demoProductosTienda: import("@/lib/types").ProductoTienda[] = [
  {
    id: "dt1",
    nombre: "Taladro percutor inalámbrico",
    descripcion: "Taladro percutor con batería recargable, ideal para pared y madera.",
    categoria: "Herramientas",
    precio_usd: 45,
    imagen_url: "https://commons.wikimedia.org/wiki/Special:FilePath/Cordless%20Drill%20-%20unbranded.jpg?width=640",
    destacado: true,
    orden: 1,
  },
  {
    id: "dt2",
    nombre: "Pintura blanca 1 galón",
    descripcion: "Pintura de caucho para interiores, acabado mate.",
    categoria: "Pintura",
    precio_usd: 18,
    imagen_url: "https://commons.wikimedia.org/wiki/Special:FilePath/Paint%20bucket%20and%20brush.jpg?width=640",
    destacado: true,
    orden: 2,
  },
  {
    id: "dt3",
    nombre: "Cinta métrica 5 m",
    descripcion: "Cinta métrica retráctil, carcasa resistente a caídas.",
    categoria: "Herramientas",
    precio_usd: 6,
    imagen_url: "https://commons.wikimedia.org/wiki/Special:FilePath/Plastic%20tape%20measure.jpg?width=640",
    destacado: false,
    orden: 3,
  },
  {
    id: "dt4",
    nombre: "Tomacorriente doble",
    descripcion: "Tomacorriente doble polarizado, color blanco.",
    categoria: "Electricidad",
    precio_usd: 4,
    imagen_url: "https://commons.wikimedia.org/wiki/Special:FilePath/Electrical-Outlet-8830c.jpg?width=640",
    destacado: false,
    orden: 4,
  },
];

// Tasas de ejemplo para el modo demo
export const DEMO_BCV = 639.7;
export const DEMO_BINANCE = 737;
export const DEMO_IVA_TASA = 16;
export const DEMO_IGTF_TASA = 3;

export const demoNegocioNombre = "Mi Ferretería";

export const demoSesion: SesionUsuario = {
  userId: "demo-user",
  email: "demo@ferreteria.com",
  username: "Líder de caja",
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

export const demoProveedores: Proveedor[] = [
  { id: "pr1", negocio_id: "demo-negocio", nombre: "Bosch", rif: "J-00112233-4", telefono: "0212-5551234", contacto: "Carlos Pérez", notas: null, activo: true, created_at: new Date().toISOString() },
  { id: "pr2", negocio_id: "demo-negocio", nombre: "Truper", rif: "J-00445566-7", telefono: "0212-5555678", contacto: null, notas: null, activo: true, created_at: new Date().toISOString() },
  { id: "pr3", negocio_id: "demo-negocio", nombre: "Cemex", rif: null, telefono: null, contacto: null, notas: "Entrega los martes", activo: true, created_at: new Date().toISOString() },
];

export const demoMetodosPago: MetodoPago[] = [
  { id: "mp1", negocio_id: "demo-negocio", tipo: "Efectivo", datos: "Paga al retirar en el local", moneda: "AMBAS", activo: true },
  { id: "mp2", negocio_id: "demo-negocio", tipo: "Pago Móvil", datos: "Banco: —  ·  Teléfono: —  ·  Cédula/RIF: —", moneda: "BS", activo: true },
  { id: "mp3", negocio_id: "demo-negocio", tipo: "Zelle", datos: "Correo: —  ·  Titular: —", moneda: "USD", activo: true },
  { id: "mp4", negocio_id: "demo-negocio", tipo: "Binance (USDT)", datos: "ID/Correo Binance: —", moneda: "USD", activo: true },
  { id: "mp5", negocio_id: "demo-negocio", tipo: "Tarjeta de crédito", datos: "Pago con punto de venta", moneda: "BS", activo: true },
  { id: "mp6", negocio_id: "demo-negocio", tipo: "Crédito", datos: "Venta a crédito (fiado) — requiere cliente identificado", moneda: "AMBAS", activo: true },
  { id: "mp7", negocio_id: "demo-negocio", tipo: "Punto de venta / Débito", datos: "Pago con tarjeta de débito", moneda: "BS", activo: true },
];

// Métodos de pago que requieren número de referencia/confirmación (todo lo
// que no sea efectivo o crédito interno).
export const metodosConReferencia = new Set([
  "Pago Móvil",
  "Zelle",
  "Binance (USDT)",
  "Tarjeta de crédito",
  "Punto de venta / Débito",
]);

export const demoClientesPos: ClientePos[] = [
  { id: "c1", cedula: "12345678", nombre: "María", apellido: "Gómez", telefono: "0414-1234567", direccion: "Av. Bella Vista, Maracaibo" },
  { id: "c2", cedula: "20111222", nombre: "José", apellido: "Rincón", telefono: "0412-7654321", direccion: "Sector La Limpia, Maracaibo" },
];

export const demoVentasPos: VentaDelDia[] = [
  { id: "v1", numero_venta: 101, total_bs: 1850, cliente_nombre: "Cliente de mostrador", created_at: new Date(Date.now() - 3 * 3600e3).toISOString(), estado: "pagado" },
  { id: "v2", numero_venta: 102, total_bs: 970.5, cliente_nombre: null, created_at: new Date(Date.now() - 1.5 * 3600e3).toISOString(), estado: "pagado" },
  { id: "v3", numero_venta: 103, total_bs: 2000, cliente_nombre: "María Gómez", created_at: new Date(Date.now() - 20 * 60e3).toISOString(), estado: "pagado" },
];

// Ventas de días anteriores, para probar el selector de fecha del historial.
const demoVentasAyer: VentaDelDia[] = [
  { id: "v0", numero_venta: 100, total_bs: 3200, cliente_nombre: "Cliente de mostrador", created_at: new Date(Date.now() - 27 * 3600e3).toISOString(), estado: "pagado" },
];

export function demoVentasPorFecha(fecha: string): VentaDelDia[] {
  const hoy = new Date().toISOString().slice(0, 10);
  const ayer = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  if (fecha === hoy) return demoVentasPos;
  if (fecha === ayer) return demoVentasAyer;
  return [];
}

export const demoCierreCaja: CierreCaja = {
  fecha: new Date().toISOString().slice(0, 10),
  total_bs: demoVentasPos.reduce((s, v) => s + v.total_bs, 0),
  ventas: demoVentasPos.length,
  por_metodo: { Efectivo: 1850, "Pago Móvil": 970.5, Zelle: 2000, "Tarjeta de crédito": 650, "Crédito": 320 },
  pendiente_por_cobrar_bs: 1180,
};

export function demoCierreCajaPorFecha(fecha: string): CierreCaja {
  const ventas = demoVentasPorFecha(fecha);
  if (ventas.length === 0) {
    return { fecha, total_bs: 0, ventas: 0, por_metodo: {}, pendiente_por_cobrar_bs: 0 };
  }
  if (fecha === demoCierreCaja.fecha) return demoCierreCaja;
  return {
    fecha,
    total_bs: ventas.reduce((s, v) => s + v.total_bs, 0),
    ventas: ventas.length,
    por_metodo: { Efectivo: ventas.reduce((s, v) => s + v.total_bs, 0) },
    pendiente_por_cobrar_bs: 0,
  };
}

// En demo no hay turno abierto al cargar: se muestra el flujo de "Abrir caja".
export const demoTurnoAbierto: TurnoCaja | null = null;

// Estado de ejemplo de las cajas del equipo, para previsualizar el panel del
// líder de caja (abrir la caja de cada vendedor con su propio monto).
export const demoEstadoCajas: EstadoCajaVendedor[] = [
  {
    usuario_id: "demo-user",
    username: "Líder de caja",
    rol: "LIDER_CAJA",
    turno_id: null,
    abierto_at: null,
    monto_apertura_bs: null,
    monto_apertura_usd: null,
  },
  {
    usuario_id: "demo-vendedor-1",
    username: "Vendedor 1",
    rol: "VENDEDOR",
    turno_id: "demo-turno-1",
    abierto_at: new Date().toISOString(),
    monto_apertura_bs: 500,
    monto_apertura_usd: 20,
  },
  {
    usuario_id: "demo-vendedor-2",
    username: "Vendedor 2",
    rol: "VENDEDOR",
    turno_id: null,
    abierto_at: null,
    monto_apertura_bs: null,
    monto_apertura_usd: null,
  },
];

// Historial de cierres de ejemplo (para previsualizar "Ver historial" en el
// panel del líder), indexado por usuario_id.
export const demoHistorialTurnos: Record<string, HistorialTurno[]> = {
  "demo-vendedor-1": [
    {
      turno_id: "demo-turno-1",
      abierto_at: new Date().toISOString(),
      cerrado_at: null,
      estado: "abierto",
      monto_apertura_bs: 500,
      monto_apertura_usd: 20,
      monto_cierre_bs: null,
      monto_cierre_usd: null,
      total_ventas_bs: 1850,
      ventas: 6,
    },
    {
      turno_id: "demo-turno-1-ayer",
      abierto_at: new Date(Date.now() - 86400e3).toISOString(),
      cerrado_at: new Date(Date.now() - 86400e3 + 8 * 3600e3).toISOString(),
      estado: "cerrado",
      monto_apertura_bs: 500,
      monto_apertura_usd: 20,
      monto_cierre_bs: 2340,
      monto_cierre_usd: 20,
      total_ventas_bs: 1820,
      ventas: 7,
    },
  ],
  "demo-vendedor-2": [
    {
      turno_id: "demo-turno-2-ayer",
      abierto_at: new Date(Date.now() - 86400e3).toISOString(),
      cerrado_at: new Date(Date.now() - 86400e3 + 7 * 3600e3).toISOString(),
      estado: "cerrado",
      monto_apertura_bs: 300,
      monto_apertura_usd: 10,
      monto_cierre_bs: 1650,
      monto_cierre_usd: 10,
      total_ventas_bs: 1340,
      ventas: 5,
    },
  ],
};

// Ítems de ejemplo para el portal público del repartidor en modo demo.
export const demoEntregaItems = [
  { id: "ei1", nombre: "Taladro percutor 750W", cantidad: 8, unidad_medida: "unidad" },
  { id: "ei2", nombre: "Cemento gris 50kg", cantidad: 20, unidad_medida: "saco" },
];

export function demoArqueo(turno: TurnoCaja): ArqueoTurno {
  const totalVentas = demoVentasPos.reduce((s, v) => s + v.total_bs, 0);
  const recibidoBs = 1850 + 970.5 + 650 + 320;
  const recibidoUsd = 2000 / DEMO_BINANCE;
  return {
    turno_id: turno.id,
    monto_apertura_bs: turno.monto_apertura_bs,
    monto_apertura_usd: turno.monto_apertura_usd,
    monto_cierre_bs: null,
    monto_cierre_usd: null,
    abierto_at: turno.abierto_at,
    cerrado_at: null,
    estado: "abierto",
    total_ventas_bs: totalVentas,
    ventas: demoVentasPos.length,
    por_metodo: [
      { metodo: "Efectivo", moneda: "BS", monto_moneda: 1850, monto_bs: 1850 },
      { metodo: "Pago Móvil", moneda: "BS", monto_moneda: 970.5, monto_bs: 970.5 },
      { metodo: "Zelle", moneda: "USD", monto_moneda: recibidoUsd, monto_bs: 2000 },
      { metodo: "Tarjeta de crédito", moneda: "BS", monto_moneda: 650, monto_bs: 650 },
      { metodo: "Crédito", moneda: "BS", monto_moneda: 320, monto_bs: 320 },
    ],
    total_recibido_bs: recibidoBs,
    total_recibido_usd: recibidoUsd,
    esperado_bs: turno.monto_apertura_bs + recibidoBs,
    esperado_usd: turno.monto_apertura_usd + recibidoUsd,
    pendiente_por_cobrar_bs: 1180,
  };
}

export const demoSaldosCreditos: SaldoCreditoCliente[] = [
  {
    cliente_cedula: "V-12345678",
    cliente_nombre: "María",
    cliente_apellido: "Gómez",
    cliente_telefono: "0414-1234567",
    total_credito_bs: 1500,
    total_abonado_bs: 500,
    saldo_bs: 1000,
    ultima_venta_at: new Date(Date.now() - 2 * 86400e3).toISOString(),
  },
  {
    cliente_cedula: "V-20111222",
    cliente_nombre: "José",
    cliente_apellido: "Rincón",
    cliente_telefono: "0412-7654321",
    total_credito_bs: 180,
    total_abonado_bs: 0,
    saldo_bs: 180,
    ultima_venta_at: new Date(Date.now() - 5 * 3600e3).toISOString(),
  },
];

export function demoDetalleCredito(cedula: string): DetalleCreditoCliente {
  const c = demoSaldosCreditos.find((x) => x.cliente_cedula === cedula) ?? demoSaldosCreditos[0];
  return {
    cliente_cedula: c.cliente_cedula,
    cliente_nombre: c.cliente_nombre,
    cliente_apellido: c.cliente_apellido,
    cliente_telefono: c.cliente_telefono,
    saldo_bs: c.saldo_bs,
    ventas: [
      {
        pedido_id: "vc1",
        numero_venta: 98,
        monto_bs: c.total_credito_bs,
        created_at: c.ultima_venta_at,
      },
    ],
    abonos: c.total_abonado_bs
      ? [
          {
            id: "ab1",
            negocio_id: "demo-negocio",
            cliente_cedula: c.cliente_cedula,
            numero_recibo: 1,
            monto: c.total_abonado_bs,
            moneda: "BS",
            monto_bs: c.total_abonado_bs,
            forma_pago: "Efectivo",
            referencia: null,
            notas: null,
            usuario_id: null,
            created_at: new Date(Date.now() - 86400e3).toISOString(),
          },
        ]
      : [],
  };
}

export const demoFacturas: (Factura & { proveedor_nombre?: string | null })[] = [
  {
    id: "f1",
    negocio_id: "demo-negocio",
    proveedor_id: "pr1",
    proveedor_nombre: "Bosch",
    numero_factura: "F-00098",
    fecha: new Date(Date.now() - 5 * 86400e3).toISOString().slice(0, 10),
    moneda: "USD",
    monto_total: 320.5,
    pagada: true,
    estado: "aplicada",
    imagen_url: null,
    notas: null,
    proveedor_nombre_nuevo: null,
    usuario_id: "demo-user",
    created_at: new Date(Date.now() - 5 * 86400e3).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400e3).toISOString(),
    token_entrega: "demo-token-f1",
    entregado: false,
    entregado_at: null,
  },
];

export const demoFinanzas: FinanzasPeriodo = {
  desde: new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10),
  hasta: new Date().toISOString().slice(0, 10),
  ventas_bs: 48250.75,
  ventas_cantidad: 62,
  ventas_usd_recibido: 6500 / DEMO_BCV + 9800 / DEMO_BCV + 5250 / DEMO_BCV,
  ventas_bs_recibido: 12000 + 12200.75 + 1500 + 1000 + 500,
  pagos_proveedor_usd: 410.2,
  pagos_proveedor_bs: 1200,
  facturas_pendientes_usd: 320.5,
  facturas_pendientes_bs: 0,
  facturas_pendientes_cantidad: 1,
  ventas_por_metodo: [
    { metodo: "Efectivo", moneda: "BS", monto_moneda: 12000, monto_bs: 12000 },
    { metodo: "Efectivo", moneda: "USD", monto_moneda: 6500 / DEMO_BCV, monto_bs: 6500 },
    { metodo: "Pago Móvil", moneda: "BS", monto_moneda: 12200.75, monto_bs: 12200.75 },
    { metodo: "Zelle", moneda: "USD", monto_moneda: 9800 / DEMO_BCV, monto_bs: 9800 },
    { metodo: "Binance (USDT)", moneda: "USD", monto_moneda: 5250 / DEMO_BCV, monto_bs: 5250 },
    { metodo: "Tarjeta de crédito", moneda: "BS", monto_moneda: 1500, monto_bs: 1500 },
    { metodo: "Punto de venta / Débito", moneda: "BS", monto_moneda: 1000, monto_bs: 1000 },
    { metodo: "Crédito", moneda: "BS", monto_moneda: 500, monto_bs: 500 },
  ],
  ventas_por_dia: Array.from({ length: 10 }, (_, i) => ({
    fecha: new Date(Date.now() - (9 - i) * 86400e3).toISOString().slice(0, 10),
    total_bs: Math.round(2500 + Math.random() * 3500),
    ventas: Math.round(3 + Math.random() * 8),
  })),
  top_productos: [
    { nombre: "Cemento gris 50kg", cantidad: 84, total_bs: 12600 },
    { nombre: "Taladro percutor 750W", cantidad: 22, total_bs: 8800 },
    { nombre: "Bombillo LED 12W", cantidad: 130, total_bs: 3900 },
    { nombre: "Tubo PVC 1/2\"", cantidad: 60, total_bs: 3000 },
    { nombre: "Cabilla 3/8", cantidad: 45, total_bs: 2700 },
  ],
  pagos_por_proveedor: [
    { proveedor: "Bosch", monto_usd: 250, monto_bs_directo: null, monto_bs: 250 * DEMO_BCV },
    { proveedor: "Truper", monto_usd: 160.2, monto_bs_directo: null, monto_bs: 160.2 * DEMO_BCV },
    { proveedor: "Cemex", monto_usd: null, monto_bs_directo: 1200, monto_bs: 1200 },
  ],
  ventas_por_vendedor: [
    { vendedor: "Vendedor 1", total_bs: 21500, ventas: 28 },
    { vendedor: "Vendedor 2", total_bs: 17300, ventas: 21 },
    { vendedor: "Vendedor 3", total_bs: 9450.75, ventas: 13 },
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
    stock_maximo: null,
    precio_venta,
    imagen_url: null,
    proveedor: extra.proveedor,
    proveedor_id: null,
    activo: true,
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

export const demoClientesAnalytics: ClientesAnalytics = {
  ticket_promedio_general_bs: 778.5,
  ticket_promedio_mes_bs: 812.3,
  compras_total: 214,
  compras_mes: 62,
  clientes_activos_mes: 38,
  clientes_nuevos_mes: 9,
  total_clientes: 96,
  top_clientes: [
    {
      cliente_id: "cli-1", cedula: "V-12345678", nombre: "Carlos", apellido: "Pérez", telefono: "04141234567",
      compras: 14, total_gastado_bs: 10850, ticket_promedio_bs: 775, ultima_compra: new Date(Date.now() - 2 * 86400e3).toISOString(),
    },
    {
      cliente_id: "cli-2", cedula: "V-9876543", nombre: "María", apellido: "González", telefono: "04241239876",
      compras: 11, total_gastado_bs: 8420, ticket_promedio_bs: 765, ultima_compra: new Date(Date.now() - 5 * 86400e3).toISOString(),
    },
    {
      cliente_id: "cli-3", cedula: "V-15556666", nombre: "José", apellido: "Fernández", telefono: "04121237788",
      compras: 9, total_gastado_bs: 6100, ticket_promedio_bs: 678, ultima_compra: new Date(Date.now() - 1 * 86400e3).toISOString(),
    },
  ],
  clientes_riesgo: [
    {
      cliente_id: "cli-4", cedula: "V-20112233", nombre: "Ana", apellido: "Rodríguez", telefono: "04161112233",
      compras: 6, total_gastado_bs: 3900, ultima_compra: new Date(Date.now() - 75 * 86400e3).toISOString(),
    },
    {
      cliente_id: "cli-5", cedula: "V-18889900", nombre: "Luis", apellido: "Ramírez", telefono: "04249998877",
      compras: 3, total_gastado_bs: 2100, ultima_compra: new Date(Date.now() - 90 * 86400e3).toISOString(),
    },
  ],
  clientes_nuevos: [
    {
      cliente_id: "cli-6", cedula: "V-25551122", nombre: "Pedro", apellido: "Silva", telefono: "04141230000",
      created_at: new Date(Date.now() - 3 * 86400e3).toISOString(),
    },
    {
      cliente_id: "cli-7", cedula: "V-26663344", nombre: "Gabriela", apellido: "Marín", telefono: "04121115566",
      created_at: new Date(Date.now() - 10 * 86400e3).toISOString(),
    },
  ],
};

export const demoCampanas: Campana[] = [
  {
    id: "camp-1", nombre: "Promo fin de mes", tipo: "promocion",
    mensaje: "¡Hola! Tenemos descuentos especiales esta semana en Mi Ferretería. Te esperamos.",
    segmento: "frecuentes", estado: "enviada",
    created_at: new Date(Date.now() - 6 * 86400e3).toISOString(),
    enviada_at: new Date(Date.now() - 6 * 86400e3).toISOString(),
    destinatarios: 12, enviados: 12,
  },
];
