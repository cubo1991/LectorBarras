"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
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
