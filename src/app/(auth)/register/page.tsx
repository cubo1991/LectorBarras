"use client";

import { useActionState } from "react";
import { registerAction } from "@/lib/actions/auth";

export default function RegisterPage() {
  // Igual que en login: se envía a una server action para que un submit previo a
  // la hidratación no mande la contraseña por la query string.
  const [state, formAction, pending] = useActionState(registerAction, null);

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-xl font-semibold">Crear cuenta</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input
          name="password"
          type="password"
          placeholder="Contraseña (mín. 8 caracteres)"
          required
          minLength={8}
          className="border p-2"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="min-h-11 bg-black p-2 text-white">
          {pending ? "Creando cuenta..." : "Registrarme"}
        </button>
      </form>
    </main>
  );
}
