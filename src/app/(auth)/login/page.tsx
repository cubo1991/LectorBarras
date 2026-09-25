"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { loginAction } from "@/lib/actions/auth";

export default function LoginPage() {
  // El form se envía a una server action, así que funciona igual si el usuario
  // lo manda antes de que la página hidrate (sin caer en un GET con la
  // contraseña en la URL).
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted">LectorBarras</p>
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Email" name="email" type="email" placeholder="Email" autoComplete="email" required />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          placeholder="Contraseña"
          autoComplete="current-password"
          required
        />
        {state?.error && <Alert>{state.error}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        ¿No tenés cuenta?
        <Link href="/register" className="inline-flex min-h-11 items-center font-medium text-accent underline">
          Crear cuenta
        </Link>
      </p>
    </main>
  );
}
