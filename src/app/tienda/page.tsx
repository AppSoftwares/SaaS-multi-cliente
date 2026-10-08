import { cargarProductosPublicos } from "@/lib/tienda";
import { TiendaPublica } from "@/components/tienda/tienda-publica";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tienda — Joel Ferretería",
  description: "Arma tu pedido y envíalo por WhatsApp. Herramientas, pintura, electricidad, plomería y más.",
};

export default async function TiendaPage() {
  const productos = await cargarProductosPublicos();
  const destacados = productos.filter((p) => p.destacado).slice(0, 1);

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <div className="bg-neutral-900 py-1.5 text-center text-[11px] font-medium text-white sm:text-xs">
        Arma tu pedido y envíalo por WhatsApp
      </div>
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="Joel Ferretería" className="h-9 w-auto object-contain sm:h-10" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pt-4">
        {/* Hero */}
        <section className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-50 to-orange-50 px-5 py-7 sm:px-8 sm:py-10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600">Joel Ferretería</p>
          <h1 className="mt-1 max-w-sm text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
            Todo para tu próximo proyecto.
          </h1>
          <p className="mt-2 max-w-xs text-sm text-neutral-600 sm:text-base">
            Encuentra lo que necesitas, agrégalo al carrito y pide por WhatsApp.
          </p>
          <a
            href="#catalogo"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-600/30 active:scale-[0.98]"
          >
            Explorar productos →
          </a>
          {destacados[0]?.imagen_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={destacados[0].imagen_url}
              alt=""
              className="pointer-events-none absolute -right-6 bottom-0 hidden h-40 w-40 rounded-2xl object-cover opacity-90 sm:block sm:h-48 sm:w-48"
            />
          )}
        </section>

        <h2 id="catalogo" className="mb-3 scroll-mt-20 text-lg font-extrabold text-neutral-900 sm:text-xl">
          Productos
        </h2>
        <TiendaPublica productos={productos} />
      </main>

      <footer className="border-t border-neutral-200 py-6 text-center text-[11px] text-neutral-400">
        Joel Ferretería · Hecho con Rose Industry
      </footer>
    </div>
  );
}
