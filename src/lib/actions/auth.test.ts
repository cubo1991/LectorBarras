import { describe, expect, it, vi } from "vitest";

// next-auth no resuelve bajo vitest (importa "next/server"); estos tests sólo
// ejercitan la validación de registerUser, que no usa signIn/signOut.
vi.mock("@/lib/auth", () => ({ signIn: async () => {}, signOut: async () => {} }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));

const { registerUser } = await import("./auth");

describe("registerUser validation", () => {
  it("rejects an invalid email without touching the database", async () => {
    const result = await registerUser({ email: "not-an-email", password: "longenough" });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it("rejects a password shorter than 8 characters", async () => {
    const result = await registerUser({ email: "user@example.com", password: "short" });

    expect(result).toEqual({ ok: false, error: "La contraseña debe tener al menos 8 caracteres" });
  });
});
