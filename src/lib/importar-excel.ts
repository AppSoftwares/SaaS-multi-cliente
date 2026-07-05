import * as XLSX from "xlsx";

export interface FilaExcel {
  fila: number; // nº de fila en el Excel (para mostrar al usuario)
  sku: string | null;
  codigo_barras: string | null;
  nombre: string | null;
  cantidad: number | null;
  cantidadValida: boolean;
}

export interface MapeoColumnas {
  sku?: string;
  codigo_barras?: string;
  nombre?: string;
  cantidad?: string;
}

function normalizar(s: string): string {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Detecta qué encabezado corresponde a cada campo (heurística por nombre).
export function detectarColumnas(headers: string[]): MapeoColumnas {
  const mapeo: MapeoColumnas = {};
  for (const h of headers) {
    const n = normalizar(h);
    if (!mapeo.codigo_barras && (n.includes("barra") || n === "ean" || n === "upc")) {
      mapeo.codigo_barras = h;
    } else if (!mapeo.sku && (n.includes("sku") || n.includes("clave") || n.includes("codigo interno") || n === "codigo" || n === "cod")) {
      mapeo.sku = h;
    }
    if (!mapeo.cantidad && (n.includes("cantidad") || n.includes("vendid") || n.includes("stock") || n.includes("existencia") || n === "cant" || n.includes("unidades"))) {
      mapeo.cantidad = h;
    }
    if (!mapeo.nombre && (n.includes("nombre") || n.includes("producto") || n.includes("descripcion") || n.includes("articulo"))) {
      mapeo.nombre = h;
    }
  }
  return mapeo;
}

// Parsea el archivo y devuelve encabezados, mapeo detectado y filas normalizadas.
export async function parsearExcel(
  file: File
): Promise<{ headers: string[]; mapeo: MapeoColumnas; filas: FilaExcel[] }> {
  const buffer = await file.arrayBuffer();
  const libro = XLSX.read(buffer, { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null });

  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  const mapeo = detectarColumnas(headers);

  const filas: FilaExcel[] = json.map((row, i) => {
    const sku = mapeo.sku ? textoOnull(row[mapeo.sku]) : null;
    const codigo_barras = mapeo.codigo_barras ? textoOnull(row[mapeo.codigo_barras]) : null;
    const nombre = mapeo.nombre ? textoOnull(row[mapeo.nombre]) : null;
    const cantRaw = mapeo.cantidad ? row[mapeo.cantidad] : null;
    const cantidad = cantRaw == null || cantRaw === "" ? null : Number(cantRaw);
    const cantidadValida = cantidad != null && Number.isFinite(cantidad) && cantidad >= 0;
    return {
      fila: i + 2, // +1 por header, +1 por índice base 1
      sku,
      codigo_barras,
      nombre,
      cantidad: cantidadValida ? cantidad : null,
      cantidadValida,
    };
  });

  return { headers, mapeo, filas };
}

function textoOnull(v: unknown): string | null {
  if (v == null) return null;
  const s = v.toString().trim();
  return s === "" ? null : s;
}
