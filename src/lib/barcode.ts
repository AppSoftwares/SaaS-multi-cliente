// Generación de códigos de barras internos (EAN-13) para productos que
// llegan sin código de barras desde una factura de proveedor.
// Prefijo "20"-"29" = uso interno/restringido según GS1 (nunca choca con un
// EAN-13 real de fábrica), seguido de 10 dígitos + dígito verificador.

function calcularDigitoVerificadorEAN13(doce: string): number {
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    const digito = Number(doce[i]);
    suma += i % 2 === 0 ? digito : digito * 3;
  }
  return (10 - (suma % 10)) % 10;
}

export function generarCodigoBarrasInterno(): string {
  const prefijo = "20";
  const resto = Math.floor(Math.random() * 10 ** 10)
    .toString()
    .padStart(10, "0");
  const doce = prefijo + resto;
  return doce + calcularDigitoVerificadorEAN13(doce);
}
