import { describe, expect, it } from "vitest";
import { registerUser } from "./auth";

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
