"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/lib/actions/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = await registerUser({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push("/login");
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">Crear cuenta</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input
          name="password"
          type="password"
          placeholder="Contraseña (mín. 8 caracteres)"
          required
          minLength={8}
          className="border p-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="bg-black p-2 text-white">
          Registrarme
        </button>
      </form>
    </main>
  );
}
