-- El descuento del proveedor por producto (ej. 25% sobre el costo de lista)
-- solo vivía en el formulario: el borrador guardaba únicamente el costo ya
-- descontado. Al reabrirlo ("Continuar") se perdían el precio de lista y el %,
-- las líneas sumaban menos que el total impreso de la factura y el aviso de
-- diferencia saltaba aunque todo estuviera bien.
--
-- Se guardan ambos datos por línea (nulos en las facturas anteriores).

alter table factura_items
  add column if not exists costo_lista numeric,
  add column if not exists descuento_pct numeric;
