// Tipos de dominio del inventario. (Si conectas la CLI de Supabase puedes
// generar tipos automáticos; estos cubren el uso de la app.)

// ADMIN = Gerente general (todo, y administra usuarios). El resto se define en
// permisos_rol (migración 0016).
export type Rol =
  | "ADMIN"
  | "ALMACEN"
  | "GERENTE_OPERATIVO"
  | "FACTURACION"
  | "LIDER_CAJA"
  | "VENDEDOR"
  | "LIDER_PATIO"
  | "DELIVERY";

export type ModuloPermiso = "inventario" | "facturas" | "caja" | "finanzas" | "delivery" | "patio";
export type NivelPermiso = "ver" | "editar";
export type MapaPermisos = Partial<Record<ModuloPermiso, NivelPermiso>>;

export interface EntregaPedido {
  id: string;
  estado: "pendiente_patio" | "listo" | "en_ruta" | "entregado" | "incidencia";
  nota: string | null;
  verificado_at: string | null;
  en_ruta_at: string | null;
  entregado_at: string | null;
  created_at: string;
  pedido: {
    id: string;
    numero_venta: number;
    cliente_nombre: string | null;
    cliente_apellido: string | null;
    cliente_telefono: string | null;
    direccion: string | null;
    costo_delivery: number;
    total_bs: number;
    pedido_items: { nombre: string; cantidad: number; unidad?: string | null }[];
  } | null;
}
export type TipoMovimiento = "INGRESO" | "AJUSTE" | "VENTA" | "ALTA";

export interface Producto {
  id: string;
  negocio_id: string;
  sku: string | null;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  categoria_id: string | null;
  marca: string | null;
  unidad_medida: string;
  cantidad: number;
  stock_minimo: number;
  stock_maximo: number | null;
  precio_venta: number;
  imagen_url: string | null;
  proveedor: string | null;
  proveedor_id: string | null;
  activo: boolean;
  ubicacion: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Precios derivados (recalculados por trigger desde las tasas del negocio)
  precio_venta_bs: number;
  // Referencia interna en USD (Bs ÷ tasa BCV del día). NO es precio oficial del
  // sistema: no se muestra ni imprime al cliente (regulación cambiaria VE).
  precio_venta_usd_ajustado: number;
  // Adjuntado solo para ADMIN (join con productos_costos)
  precio_costo?: number | null;
}

export interface Proveedor {
  id: string;
  negocio_id: string;
  nombre: string;
  rif: string | null;
  telefono: string | null;
  contacto: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

export type OrigenPedido = "bot" | "pos";

export type MonedaPago = "BS" | "USD";
export type TipoDescuento = "porcentaje" | "monto";

export interface PedidoPago {
  id: string;
  pedido_id: string;
  metodo: string;
  moneda: MonedaPago;
  monto_moneda: number;
  monto_bs: number;
  referencia: string | null;
  igtf_monto_bs?: number;
  created_at: string;
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  nombre: string;
  cantidad: number;
  precio_bs: number;
  subtotal_bs: number;
  descuento_tipo: TipoDescuento | null;
  descuento_valor: number | null;
  descuento_monto_bs: number;
}

export interface Pedido {
  id: string;
  negocio_id: string;
  telegram_id: number | null;
  cliente_id: string | null;
  estado: string;
  origen: OrigenPedido;
  usuario_id: string | null;
  cliente_cedula: string | null;
  cliente_nombre: string | null;
  cliente_apellido: string | null;
  cliente_direccion: string | null;
  cliente_telefono: string | null;
  numero_venta: number;
  subtotal_bs: number;
  descuento_tipo: TipoDescuento | null;
  descuento_valor: number | null;
  descuento_monto_bs: number;
  base_imponible_bs: number;
  aplica_iva: boolean;
  iva_monto_bs: number;
  aplica_igtf: boolean;
  igtf_monto_bs: number;
  total_bs: number;
  total_usd: number;
  metodo_pago: string | null;
  tipo_entrega?: "delivery" | "retiro" | null;
  costo_delivery?: number;
  direccion?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VentaPosItem {
  producto_id: string;
  cantidad: number;
  descuento_tipo?: TipoDescuento | null;
  descuento_valor?: number | null;
}

export interface VentaPosPago {
  metodo: string;
  moneda: MonedaPago;
  monto: number;
  referencia?: string | null;
}

export interface ResultadoVentaPos {
  pedido_id: string;
  numero_venta: number;
  total_bs: number;
  subtotal_bs: number;
  descuento_monto_bs: number;
  base_imponible_bs: number;
  iva_monto_bs: number;
  igtf_monto_bs: number;
  delivery_monto_bs: number;
}

export interface MetodoPago {
  id: string;
  negocio_id: string;
  tipo: string;
  datos: string;
  moneda: "BS" | "USD" | "AMBAS";
  activo: boolean;
}

// Cliente registrado (cédula, nombre completo, dirección) — se autocompleta
// en el POS al escribir la cédula y se imprime en el ticket.
export interface ClientePos {
  id: string;
  cedula: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
}

// Subconjunto de Producto usado para buscar/agregar al carrito del POS.
export interface ProductoPos {
  id: string;
  nombre: string;
  codigo_barras: string | null;
  unidad_medida: string;
  cantidad: number;
  stock_minimo: number;
  precio_venta: number;
  precio_venta_bs: number;
  precio_venta_usd_ajustado: number;
}

// Línea del carrito en el POS (no persiste hasta cobrar).
export interface ItemCarritoPos {
  producto_id: string;
  nombre: string;
  codigo_barras: string | null;
  unidad_medida: string;
  cantidad: number;
  stock_disponible: number;
  precio_venta: number;
  precio_venta_bs: number;
  precio_venta_usd_ajustado: number;
  stock_minimo: number;
  descuento_tipo: TipoDescuento | null;
  descuento_valor: number;
}

export interface CierreCaja {
  fecha: string;
  total_bs: number;
  ventas: number;
  por_metodo: Record<string, number>;
  pendiente_por_cobrar_bs: number;
}

export interface VentaDelDia {
  id: string;
  numero_venta: number;
  total_bs: number;
  cliente_nombre: string | null;
  created_at: string;
  estado: string;
}

export interface TurnoCaja {
  id: string;
  negocio_id: string;
  usuario_id: string;
  monto_apertura_bs: number;
  monto_apertura_usd: number;
  monto_cierre_bs: number | null;
  monto_cierre_usd: number | null;
  abierto_at: string;
  cerrado_at: string | null;
  estado: "abierto" | "cerrado";
}

export interface ArqueoPorMetodo {
  metodo: string;
  moneda: MonedaPago;
  monto_moneda: number;
  monto_bs: number;
}

export interface ArqueoTurno {
  turno_id: string;
  monto_apertura_bs: number;
  monto_apertura_usd: number;
  monto_cierre_bs: number | null;
  monto_cierre_usd: number | null;
  abierto_at: string;
  cerrado_at: string | null;
  estado: "abierto" | "cerrado";
  total_ventas_bs: number;
  ventas: number;
  por_metodo: ArqueoPorMetodo[];
  total_recibido_bs: number;
  total_recibido_usd: number;
  esperado_bs: number;
  esperado_usd: number;
  pendiente_por_cobrar_bs: number;
}

export interface TasasNegocio {
  tasa_bcv: number | null;
  tasa_binance: number | null;
  tasa_actualizada_at: string | null;
}

export type MonedaCotizacion = "BS" | "USD";

export interface ItemCotizacionInput {
  producto_id: string;
  cantidad: number;
}

export interface ItemCotizacionResultado {
  nombre: string;
  cantidad: number;
  precio_unit: number;
  subtotal: number;
}

export interface ResultadoCotizacion {
  cotizacion_id: string;
  numero_cotizacion: number;
  total: number;
}

export interface UsuarioNegocio {
  id: string;
  username: string | null;
  email: string | null;
  rol: Rol;
  created_at: string;
}

export interface Movimiento {
  id: string;
  negocio_id: string;
  producto_id: string;
  tipo: TipoMovimiento;
  cantidad_afectada: number;
  cantidad_resultante: number;
  usuario_id: string | null;
  nota: string | null;
  created_at: string;
}

// Datos que la IA extrae de la foto + dictado (Structured Output)
export interface DatosIA {
  categoria: string;
  nombre: string;
  descripcion: string;
  cantidad: number;
  sku: string | null;
  codigo_barras: string | null;
  marca: string | null;
  unidad_medida: string;
  precio_venta: number;
}

// Catálogos administrables
export interface Categoria {
  id: string;
  nombre: string;
  parent_id: string | null;
}

export interface OpcionCatalogo {
  id: string;
  nombre: string;
}

export interface Catalogos {
  categorias: Categoria[];
  marcas: OpcionCatalogo[];
  unidades: OpcionCatalogo[];
}

export type ResultadoProcesamiento =
  | { status: "EXISTING"; producto_bd: Producto; datos_ia: DatosIA; mensaje: string }
  | { status: "NEW"; datos_ia: DatosIA };

export interface KpisDashboard {
  total_productos: number;
  bajo_stock: number;
  valor_inventario_venta: number;
  valor_inventario_costo: number | null;
}

// ---------------------------------------------------------------------------
// Facturas de proveedores (foto -> IA -> revisión -> stock)
// ---------------------------------------------------------------------------
export type EstadoFactura = "borrador" | "revision" | "aplicada";

export interface Factura {
  id: string;
  negocio_id: string;
  proveedor_id: string | null;
  numero_factura: string | null;
  fecha: string | null;
  moneda: "BS" | "USD";
  monto_total: number;
  pagada: boolean;
  estado: EstadoFactura;
  imagen_url: string | null;
  notas: string | null;
  proveedor_nombre_nuevo: string | null;
  dias_credito?: number | null;
  fecha_vencimiento?: string | null;
  usuario_id: string | null;
  created_at: string;
  updated_at: string;
  token_entrega: string;
  entregado: boolean;
  entregado_at: string | null;
}

export interface FacturaItem {
  id: string;
  factura_id: string;
  producto_id: string | null;
  nombre: string;
  sku: string | null;
  codigo_barras: string | null;
  cantidad: number;
  precio_costo: number;
  precio_venta_sugerido: number | null;
  // Costo de lista y % de descuento del proveedor (precio_costo es el neto).
  costo_lista?: number | null;
  descuento_pct?: number | null;
  // Clasificación elegida para un producto nuevo (se conserva en el borrador).
  categoria_madre?: string | null;
  categoria_sub?: string | null;
  marca?: string | null;
  unidad_medida?: string | null;
  utilidad_pct?: number | null;
  subtotal: number;
  es_nuevo: boolean;
  aplicado: boolean;
  created_at: string;
}

export interface PagoProveedor {
  id: string;
  negocio_id: string;
  factura_id: string;
  numero_recibo: number;
  monto: number;
  moneda: "BS" | "USD";
  forma_pago: string;
  referencia: string | null;
  notas: string | null;
  usuario_id: string | null;
  created_at: string;
}

export interface FacturaConItems extends Factura {
  proveedor_nombre?: string | null;
  items: FacturaItem[];
}

// Resumen financiero de un período (ventas vs pagos a proveedores) para el
// módulo de Finanzas (solo ADMIN).
export interface VentaPorDia {
  fecha: string;
  total_bs: number;
  ventas: number;
}

export interface TopProducto {
  nombre: string;
  cantidad: number;
  total_bs: number;
}

export interface PagoPorProveedor {
  proveedor: string;
  monto_usd: number | null;
  monto_bs_directo: number | null;
  monto_bs: number;
}

export interface VentaPorMetodo {
  metodo: string;
  moneda: "BS" | "USD";
  monto_moneda: number;
  monto_bs: number;
}

export interface FinanzasPeriodo {
  desde: string;
  hasta: string;
  ventas_bs: number;
  ventas_cantidad: number;
  ventas_usd_recibido: number;
  ventas_bs_recibido: number;
  pagos_proveedor_usd: number;
  pagos_proveedor_bs: number;
  facturas_pendientes_usd: number;
  facturas_pendientes_bs: number;
  facturas_pendientes_cantidad: number;
  ventas_por_metodo: VentaPorMetodo[];
  ventas_por_dia: VentaPorDia[];
  top_productos: TopProducto[];
  pagos_por_proveedor: PagoPorProveedor[];
}

// ---------------------------------------------------------------------------
// Créditos a clientes (ventas "fiado" pagadas con metodo = 'Crédito' + abonos)
// ---------------------------------------------------------------------------
export interface CobroCredito {
  id: string;
  negocio_id: string;
  cliente_cedula: string;
  numero_recibo: number;
  monto: number;
  moneda: "BS" | "USD";
  monto_bs: number;
  forma_pago: string;
  referencia: string | null;
  notas: string | null;
  usuario_id: string | null;
  created_at: string;
}

export interface SaldoCreditoCliente {
  cliente_cedula: string;
  cliente_nombre: string | null;
  cliente_apellido: string | null;
  cliente_telefono: string | null;
  total_credito_bs: number;
  total_abonado_bs: number;
  saldo_bs: number;
  ultima_venta_at: string;
}

export interface VentaCreditoResumen {
  pedido_id: string;
  numero_venta: number;
  monto_bs: number;
  created_at: string;
}

export interface DetalleCreditoCliente {
  cliente_cedula: string;
  cliente_nombre: string | null;
  cliente_apellido: string | null;
  cliente_telefono: string | null;
  saldo_bs: number;
  ventas: VentaCreditoResumen[];
  abonos: CobroCredito[];
}

// Ítem de línea extraído por la IA de la foto de la factura.
export interface DatosFacturaItemIA {
  nombre: string;
  sku: string | null;
  codigo_barras: string | null;
  cantidad: number;
  precio_costo: number;
  producto_id_sugerido?: string | null;
}

// Datos completos que la IA extrae de la foto de una factura de proveedor.
export interface DatosFacturaIA {
  numero_factura: string | null;
  fecha: string | null;
  proveedor_nombre: string | null;
  moneda: "BS" | "USD";
  monto_total: number;
  items: DatosFacturaItemIA[];
}

// Resultado de conciliar cada ítem contra el inventario existente.
export type ItemFacturaProcesado =
  | { status: "EXISTING"; item_ia: DatosFacturaItemIA; producto_bd: Producto }
  | { status: "NEW"; item_ia: DatosFacturaItemIA };

export interface ResultadoProcesarFactura {
  numero_factura: string | null;
  fecha: string | null;
  proveedor_nombre: string | null;
  moneda: "BS" | "USD";
  monto_total: number;
  dias_credito?: number | null;
  items: ItemFacturaProcesado[];
}

// ---------------------------------------------------------------------------
// Marketing: analítica de clientes + campañas por WhatsApp (wa.me)
// ---------------------------------------------------------------------------
export interface ClienteMarketing {
  cliente_id: string;
  cedula: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  compras?: number;
  total_gastado_bs?: number;
  ticket_promedio_bs?: number;
  ultima_compra?: string;
  created_at?: string;
}

export interface ClientesAnalytics {
  ticket_promedio_general_bs: number;
  ticket_promedio_mes_bs: number;
  compras_total: number;
  compras_mes: number;
  clientes_activos_mes: number;
  clientes_nuevos_mes: number;
  total_clientes: number;
  top_clientes: ClienteMarketing[];
  clientes_riesgo: ClienteMarketing[];
  clientes_nuevos: ClienteMarketing[];
}

export type TipoCampana = "reactivacion" | "promocion" | "fidelizacion" | "bienvenida" | "anuncio";
export type SegmentoCampana = "frecuentes" | "riesgo" | "nuevos" | "manual";

export interface DestinatarioCampana {
  cliente_id: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
}

export interface ResultadoCrearCampana {
  campana_id: string;
  destinatarios: DestinatarioCampana[];
}

export interface Campana {
  id: string;
  nombre: string;
  tipo: TipoCampana;
  mensaje: string;
  segmento: SegmentoCampana;
  estado: "borrador" | "enviada";
  created_at: string;
  enviada_at: string | null;
  destinatarios: number;
  enviados: number;
}
