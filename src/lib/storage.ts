import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "productos-img";

// Comprime la imagen en el navegador y la sube a Supabase Storage.
// Devuelve la URL pública.
export async function comprimirYSubir(file: File): Promise<string> {
  const comprimida = await imageCompression(file, {
    maxSizeMB: 0.6,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  });
  return subirComprimida(comprimida);
}

// Igual que comprimirYSubir, pero con mucha más resolución: pensada para
// fotos de FACTURAS con muchas líneas de texto pequeño (hasta 60 ítems).
// A 1280px la IA de visión solo lograba leer con confianza las primeras 2-3
// líneas; 2400px conserva el texto legible sin disparar el tamaño del archivo.
export async function comprimirYSubirFactura(file: File): Promise<string> {
  const comprimida = await imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2400,
    useWebWorker: true,
  });
  return subirComprimida(comprimida);
}

async function subirComprimida(comprimida: File | Blob): Promise<string> {
  const supabase = createClient();
  const tipo = "type" in comprimida ? comprimida.type : "image/jpeg";
  const ext = (tipo.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const nombre = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(nombre, comprimida, {
    contentType: tipo,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
  return data.publicUrl;
}
