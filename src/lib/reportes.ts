import * as XLSX from "xlsx";

// Genera y descarga un .xlsx a partir de filas (objetos planos).
export function descargarXlsx(
  filas: Record<string, unknown>[],
  nombreHoja: string,
  nombreArchivo: string
) {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(libro, `${nombreArchivo}_${fecha}.xlsx`);
}
