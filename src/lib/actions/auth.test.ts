import { describe, expect, it, vi } from "vitest";

// next-auth no resuelve bajo vitest (importa "next/server"); estos tests sólo
// ejercitan la validación de registerUser, que no usa signIn/signOut.
const signIn = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/auth", () => ({ signIn, signOut: async () => {} }));
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type = "";
  },
}));

const { AuthError } = await import("next-auth");
const { registerUser, loginAction } = await import("./auth");

const authError = (type: string) => Object.assign(new AuthError(), { type });
const form = () => {
  const data = new FormData();
  data.set("email", "user@example.com");
  data.set("password", "longenough");
  return data;
};

describe("loginAction", () => {
  it("credenciales incorrectas → mensaje de contraseña incorrecta", async () => {
    signIn.mockRejectedValueOnce(authError("CredentialsSignin"));

    expect(await loginAction(null, form())).toEqual({ error: "Email o contraseña incorrectos" });
  });

  it("otro AuthError (ej. la DB caída) no se disfraza de contraseña incorrecta", async () => {
    signIn.mockRejectedValueOnce(authError("AdapterError"));

    await expect(loginAction(null, form())).rejects.toThrow();
  });
});

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
