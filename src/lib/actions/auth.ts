"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerUser(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return { ok: false, error: "Ya existe una cuenta con ese email" };
  }

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ email, passwordHash });

  return { ok: true };
}

/**
 * Estado de los formularios de auth. `null` es "todavía no se envió".
 *
 * Estas tres acciones existen para que los `<form>` se envíen al server en vez
 * de depender del `onSubmit` de React: si el usuario enviaba antes de que la
 * página hidratara, el browser hacía un GET nativo y la contraseña quedaba en
 * la URL (y en el historial y en los logs del server).
 */
export type AuthFormState = { error: string } | null;

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    // signIn señaliza el redirect exitoso lanzando: sólo tragamos AuthError.
    if (error instanceof AuthError) {
      return { error: "Email o contraseña incorrectos" };
    }
    throw error;
  }
  return null;
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = await registerUser({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/login");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
