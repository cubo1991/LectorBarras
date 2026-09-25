import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Inicio</h1>
        {session?.user?.email && (
          <p className="text-sm text-muted">
            Sesión de <span className="font-medium text-foreground">{session.user.email}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/scan"
          className="flex min-h-28 flex-col justify-center gap-1 rounded-control bg-accent p-5 text-accent-foreground"
        >
          <span className="text-xl font-semibold">Escanear producto</span>
          <span className="text-sm">Usá la cámara para ver o ajustar el stock.</span>
        </Link>
        <Link
          href="/products"
          className="flex min-h-28 flex-col justify-center gap-1 rounded-control border border-border-strong bg-surface p-5"
        >
          <span className="text-xl font-semibold">Buscar productos</span>
          <span className="text-sm text-muted">Por nombre o código, sin escanear.</span>
        </Link>
      </div>
    </main>
  );
}
