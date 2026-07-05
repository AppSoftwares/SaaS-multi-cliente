import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { NavInferior } from "@/components/nav-inferior";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await getSesion();

  // El middleware ya redirige a /login si no hay sesión.
  if (!sesion) redirect("/login");
  // Con sesión pero sin negocio => primer uso.
  if (!sesion.negocioId) redirect("/onboarding");

  const esAdmin = sesion.rol === "ADMIN";

  return (
    <div className="min-h-dvh flex flex-col pb-20">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4">{children}</main>
      <NavInferior esAdmin={esAdmin} />
    </div>
  );
}
