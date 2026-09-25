import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { NavLink } from "@/components/ui/NavLink";

/**
 * Shell de las pantallas autenticadas. En el celular la navegación es una barra
 * inferior (al alcance del pulgar); desde `sm` pasa al encabezado. Sin <ul>/<li>:
 * los e2e cuentan `listitem` para verificar la paginación de /products.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-8">
        <Link href="/scan" className="flex min-h-11 items-center font-semibold">
          LectorBarras
        </Link>
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 flex border-t border-border bg-background sm:static sm:border-t-0"
        >
          <NavLink href="/scan">Escanear</NavLink>
          <NavLink href="/products">Productos</NavLink>
        </nav>
        <LogoutButton />
      </header>
      <div className="pb-16 sm:pb-0">{children}</div>
    </>
  );
}
