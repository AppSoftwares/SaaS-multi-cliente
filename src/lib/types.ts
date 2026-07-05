// Tipos de dominio del inventario. (Si conectas la CLI de Supabase puedes
// generar tipos automáticos; estos cubren el uso de la app.)

export type Rol = "ADMIN" | "ALMACEN";
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
  precio_venta: number;
  imagen_url: string | null;
  proveedor: string | null;
  ubicacion: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Precios derivados (recalculados por trigger desde las tasas del negocio)
  precio_venta_bs: number;
  precio_venta_usd_ajustado: number;
  // Adjuntado solo para ADMIN (join con productos_costos)
  precio_costo?: number | null;
}

export interface TasasNegocio {
  tasa_bcv: number | null;
  tasa_binance: number | null;
  tasa_actualizada_at: string | null;
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
