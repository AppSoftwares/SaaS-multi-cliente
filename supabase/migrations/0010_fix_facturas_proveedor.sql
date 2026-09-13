-- Cambios al flujo de facturas de proveedor pedidos por el cliente
-- (Joel Ferretería, ronda de cambios de 2026-09-09):
--
-- 1. proveedor_nombre_nuevo: el nombre de un proveedor tecleado a mano (no
--    seleccionado de la lista) no se persistía al guardar un borrador —
--    guardarBorrador() solo mandaba proveedor_id, así que un proveedor nuevo
--    se perdía al reabrir el borrador (se veía "como si tocara agregarlo de
--    nuevo"). Se agrega la columna para persistirlo hasta que se resuelva a
--    un proveedor real en confirmar().

alter table facturas
  add column if not exists proveedor_nombre_nuevo text;
