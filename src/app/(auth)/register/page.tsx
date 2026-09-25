"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { registerAction } from "@/lib/actions/auth";

export default function RegisterPage() {
  // Igual que en login: se envía a una server action para que un submit previo a
  // la hidratación no mande la contraseña por la query string.
  const [state, formAction, pending] = useActionState(registerAction, null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted">LectorBarras</p>
        <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Email" name="email" type="email" placeholder="Email" autoComplete="email" required />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          placeholder="Contraseña (mín. 8 caracteres)"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {state?.error && <Alert>{state.error}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Creando cuenta..." : "Registrarme"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-accent underline">
          Iniciar sesión
        </Link>
      </p>
    </main>
  );
}
