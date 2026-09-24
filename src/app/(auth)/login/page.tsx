"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";

export default function LoginPage() {
  // El form se envía a una server action, así que funciona igual si el usuario
  // lo manda antes de que la página hidrate (sin caer en un GET con la
  // contraseña en la URL).
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input
          name="password"
          type="password"
          placeholder="Contraseña"
          required
          className="border p-2"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="min-h-11 bg-black p-2 text-white">
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
