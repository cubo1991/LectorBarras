import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("never stores the password in plain text", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).not.toBe("correct horse battery staple");
  });
});
