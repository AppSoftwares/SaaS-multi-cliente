// Constantes que también usa el carrito (cliente): en archivo aparte para que
// el bundle del navegador no arrastre el loader de servidor (next/headers).

// Esta app se despliega una instancia por negocio (Joel Ferretería). El
// esquema admite varios negocios (onboarding), pero la tienda pública de este
// despliegue es siempre la de Joel.
export const NEGOCIO_TIENDA_ID = "98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5";

// Número de WhatsApp donde caen los pedidos de la tienda. Sin configurar,
// linkWhatsApp() abre el selector de contactos (no se pierde el pedido, pero
// no llega a nadie en particular: hay que configurar WA_PEDIDOS en Vercel).
export const WA_PEDIDOS = process.env.NEXT_PUBLIC_WA_PEDIDOS || "";
