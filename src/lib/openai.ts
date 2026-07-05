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
