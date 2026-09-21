import JsBarcode from "jsbarcode";

export interface EtiquetaImprimible {
  nombre: string;
  codigo: string;
  copias: number;
}

function svgBarras(codigo: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const opciones = { width: 2, height: 46, fontSize: 13, margin: 2 };
  try {
    JsBarcode(svg, codigo, { format: "EAN13", ...opciones });
  } catch {
    JsBarcode(svg, codigo, { format: "CODE128", ...opciones });
  }
  svg.setAttribute("style", "width:100%;height:auto;max-height:18mm");
  return svg.outerHTML;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Abre una ventana propia con todas las etiquetas y lanza la impresión. Se usa
// una ventana aparte (y no window.print de la app) porque la hoja de impresión
// de la app solo muestra el ticket de 80 mm y porque así se imprimen muchas
// etiquetas en varias páginas.
export function imprimirEtiquetas(etiquetas: EtiquetaImprimible[]): boolean {
  const celdas: string[] = [];
  for (const e of etiquetas) {
    if (!e.codigo) continue;
    const barras = svgBarras(e.codigo);
    for (let i = 0; i < Math.max(1, Math.floor(e.copias)); i++) {
      celdas.push(`<div class="et"><p>${esc(e.nombre)}</p>${barras}</div>`);
    }
  }
  if (celdas.length === 0) return false;

  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title>
<style>
  @page { margin: 6mm; }
  body { margin: 0; font-family: Arial, sans-serif; color: #000; }
  .rejilla { display: flex; flex-wrap: wrap; gap: 3mm; }
  .et { width: 56mm; height: 30mm; box-sizing: border-box; border: 1px dashed #999; padding: 1.5mm 2mm;
        display: flex; flex-direction: column; align-items: center; justify-content: center; break-inside: avoid; overflow: hidden; }
  .et p { margin: 0 0 1mm; font-size: 8.5pt; font-weight: 600; text-align: center; line-height: 1.15;
          max-height: 2.4em; overflow: hidden; }
</style></head><body><div class="rejilla">${celdas.join("")}</div>
<script>window.onload = function(){ window.focus(); window.print(); };<\/script></body></html>`);
  w.document.close();
  return true;
}
