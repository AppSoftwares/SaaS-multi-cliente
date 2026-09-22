import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

// Cliente OpenAI (solo servidor).
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Esquema estricto que la IA debe devolver. Con .nullable() en los campos que
// pueden no deducirse, para cumplir Structured Outputs (todos requeridos).
export const EsquemaProductoIA = z.object({
  categoria: z.string().describe("Categoría general del producto de ferretería (ej. Herramientas, Tornillería, Plomería, Eléctrico, Pinturas)."),
  nombre: z.string().describe("Nombre conciso y comercial del producto."),
  descripcion: z.string().describe("Material, medidas, color, presentación u otros atributos."),
  cantidad: z.number().int().describe("Cantidad de unidades identificadas. Si no se puede deducir, usar 1."),
  sku: z.string().nullable().describe("Código interno/SKU si es visible; si no, null."),
  codigo_barras: z.string().nullable().describe("Código de barras (EAN/UPC) si es legible; si no, null."),
  marca: z.string().nullable().describe("Marca del producto si es visible o se menciona (ej. Stanley, Truper); si no, null."),
  unidad_medida: z.string().describe("Unidad: 'Unidad', 'Caja', 'Galón', 'Litro', 'Metro', 'Kilogramo', etc. Por defecto 'Unidad'."),
  precio_venta: z.number().describe("Precio de venta en USD si es visible; si no, 0."),
});

export type ProductoIA = z.infer<typeof EsquemaProductoIA>;

const SISTEMA = `Eres un asistente de inventario para una ferretería. A partir de una foto del producto
y/o una descripción hablada, extrae los datos del producto en el esquema JSON solicitado.
Deduce la categoría típica de ferretería. Sé conciso en el nombre. Si un dato no se puede
determinar con seguridad, usa null (o los valores por defecto indicados). Responde en español.`;

// Extrae datos estructurados del producto desde texto (dictado) e imagen (opcional).
export async function extraerDatosProducto(
  texto: string,
  imagenUrl?: string | null
): Promise<ProductoIA> {
  const contenidoUsuario: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  if (texto?.trim()) {
    contenidoUsuario.push({ type: "text", text: `Descripción hablada: ${texto}` });
  } else {
    contenidoUsuario.push({ type: "text", text: "Extrae los datos del producto de la imagen." });
  }
  if (imagenUrl) {
    contenidoUsuario.push({ type: "image_url", image_url: { url: imagenUrl } });
  }

  const completion = await openai.chat.completions.parse({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: SISTEMA },
      { role: "user", content: contenidoUsuario },
    ],
    response_format: zodResponseFormat(EsquemaProductoIA, "producto"),
  });

  const datos = completion.choices[0]?.message.parsed;
  if (!datos) {
    throw new Error("La IA no devolvió datos válidos");
  }
  return datos;
}

// Esquema de una factura de proveedor: cabecera + líneas de productos.
export const EsquemaFacturaIA = z.object({
  numero_factura: z.string().nullable().describe("Número o serial de la factura si es legible; si no, null."),
  fecha: z.string().nullable().describe("Fecha de la factura en formato YYYY-MM-DD si es legible; si no, null."),
  proveedor_nombre: z.string().nullable().describe("Nombre del proveedor/empresa emisora si aparece; si no, null."),
  moneda: z.enum(["BS", "USD"]).describe("Moneda en la que están expresados los montos de la factura."),
  monto_total: z.number().describe("Monto total de la factura. Si no es legible, 0."),
  dias_credito: z
    .number()
    .nullable()
    .describe("Días de crédito que otorga el proveedor (ej. 15 o 30) si la factura lo indica; si es de contado o no aparece, null."),
  items: z
    .array(
      z.object({
        nombre: z.string().describe("Nombre del producto tal como aparece en la factura."),
        sku: z.string().nullable().describe("Código interno/SKU si es visible; si no, null."),
        codigo_barras: z.string().nullable().describe("Código de barras (EAN/UPC) si es legible; si no, null."),
        cantidad: z.number().describe("Cantidad facturada de este ítem."),
        precio_costo: z.number().describe("Precio unitario de costo (lo que paga el negocio) según la factura."),
      })
    )
    .describe("Líneas de productos de la factura."),
});

export type FacturaIA = z.infer<typeof EsquemaFacturaIA>;

const SISTEMA_FACTURA = `Eres un asistente contable para una ferretería. A partir de la foto de una
factura de un proveedor, extrae la cabecera (número, fecha, proveedor, moneda, total) y cada línea
de producto (nombre, sku, código de barras, cantidad, precio de costo unitario) en el esquema JSON
solicitado. Si un dato no se puede determinar con seguridad, usa null (o 0 para números). No inventes
líneas que no estén en la factura. IMPORTANTE: las facturas reales de este negocio suelen tener entre
20 y 60 líneas de producto. Recorre la imagen de arriba hacia abajo y extrae TODAS las líneas visibles,
no te detengas después de las primeras 2 o 3; si una línea se ve borrosa, extrae los campos que sí
puedas leer con confianza y usa null en el resto, pero igual inclúyela. Responde en español.`;

// Extrae los datos estructurados de una factura de proveedor desde su foto.
export async function extraerDatosFactura(imagenUrl: string): Promise<FacturaIA> {
  const completion = await openai.chat.completions.parse({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: SISTEMA_FACTURA },
      {
        role: "user",
        content: [
          { type: "text", text: "Extrae los datos de esta factura de proveedor." },
          { type: "image_url", image_url: { url: imagenUrl } },
        ],
      },
    ],
    response_format: zodResponseFormat(EsquemaFacturaIA, "factura"),
  });

  const datos = completion.choices[0]?.message.parsed;
  if (!datos) {
    throw new Error("La IA no devolvió datos válidos");
  }
  return datos;
}
