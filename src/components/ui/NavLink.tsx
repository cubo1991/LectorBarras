"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkProps = { href: string; children: React.ReactNode };

/** Link de navegación que marca la sección activa. Inicio (`/`) sólo coincide exacto. */
export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // Activo = acento + negrita + barra superior: no depende sólo del color.
      className={`flex min-h-11 flex-1 items-center justify-center border-t-2 px-3 text-sm sm:flex-none sm:border-t-0 sm:border-b-2 ${
        active ? "border-accent font-semibold text-accent" : "border-transparent text-muted"
      }`}
    >
      {children}
    </Link>
  );
}
