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

  const supabase = createClient();
  const ext = (comprimida.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const nombre = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(nombre, comprimida, {
    contentType: comprimida.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
  return data.publicUrl;
}
