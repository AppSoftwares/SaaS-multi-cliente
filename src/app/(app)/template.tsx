// App Router re-monta este template en cada navegación → transición por pantalla.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-in-up">{children}</div>;
}
