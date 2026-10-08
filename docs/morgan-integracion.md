# Integración con Morgan AI

API publicada y catálogo sincronizado: 5472 registros, 2 fotos. Fuente limitada al negocio 98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5.

- POST /api/tienda/morgan/catalogo: búsqueda, IDs y paginación hasta 150 registros.
- POST /api/tienda/morgan/pedidos: importar, consultar, reintentar, tasas y vista previa.
- Bearer MORGAN_INTEGRATION_TOKEN cifrado en Vercel; nunca enviar desde navegador.
- /morgan: administrador existente revisa datos de pago y aprueba un comprobante verificado.
- /api/tienda/morgan/gestion usa sesión Supabase y rol ADMIN; la clave de integración no permite aprobar pagos.
- Cotización fija por solicitud; reintentos no crean pedidos nuevos. El inventario y la venta se procesan con las funciones nativas después de aprobar.
- Migraciones 0016 a 0019 aplicadas. Se creó el registro de migraciones para estas versiones donde no existía; no se reprodujo ni se marcó artificialmente el historial anterior.

La integración está en la rama codex/morgan-integration-20261002, en la copia aislada bajo morgan/artifacts/integration-worktrees/inventario-ferreteria. La publicación usa esta copia completa. La carpeta original conserva todos sus cambios previos. 

Cada comercio conserva su propia configuración de tasas, pagos y entrega. No se configuraron datos bancarios o tasas inventadas. WhatsApp usa el servicio existente cuando esté configurado; de lo contrario, se ofrece el mensaje manual. La automatización de enlaces entrantes y comprobantes depende del canal existente, no se activaron workflows.

Compilación local y publicación Vercel correctas; catálogo y tasas consultados con autorización. No se crearon pedidos de prueba ni se enviaron mensajes.
