import { describe, it, expect } from "vitest";
import { loginSchema } from "../schemas/login.schema";

describe("loginSchema", () => {
  it("validates valid credentials", () => {
    const validData = {
      username: "corporate.lead@telecrats.in",
      password: "SecretPassword123!",
      rememberMe: true,
    };
    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("fails when username is empty", () => {
    const invalidData = {
      username: "   ",
      password: "SecretPassword123!",
      rememberMe: false,
    };
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Username or corporate email is required");
    }
  });

  it("fails when password is empty", () => {
    const invalidData = {
      username: "validuser",
      password: "",
      rememberMe: false,
    };
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Password is required");
    }
  });
});
