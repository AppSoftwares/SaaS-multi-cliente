-- El borrador de una factura solo guardaba nombre, cantidad, costo y precio: al
-- reabrirlo ("Continuar") se perdían la categoría, subcategoría, marca, unidad y
-- el % de utilidad que ya se habían elegido para cada producto nuevo.
-- Se guardan por línea (nulos en las facturas anteriores).

alter table factura_items
  add column if not exists categoria_madre text,
  add column if not exists categoria_sub text,
  add column if not exists marca text,
  add column if not exists unidad_medida text,
  add column if not exists utilidad_pct numeric;
