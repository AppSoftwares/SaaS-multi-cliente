import * as XLSX from "xlsx";
import { esNativo, compartirArchivoNativo } from "@/lib/nativo";

// Genera y descarga un .xlsx a partir de filas (objetos planos).
export async function descargarXlsx(
  filas: Record<string, unknown>[],
  nombreHoja: string,
  nombreArchivo: string
) {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  const fecha = new Date().toISOString().slice(0, 10);
  const fileName = `${nombreArchivo}_${fecha}.xlsx`;

  if (esNativo()) {
    const base64Data = XLSX.write(libro, { type: "base64", bookType: "xlsx" });
    await compartirArchivoNativo(fileName, base64Data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return;
  }

  XLSX.writeFile(libro, fileName);
}
