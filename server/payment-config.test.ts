import { describe, expect, it } from "vitest";
import { decryptPaymentSecret, encryptPaymentSecret, paymentConfigInput } from "./payment-config";
import { ENV } from "./_core/env";

describe("payment config security", () => {
  it("encrypts and decrypts credentials without storing plaintext", () => {
    ENV.cookieSecret = "test-jwt-secret-that-is-longer-than-32-characters";
    const secret = "wx-api-v3-secret-32-characters-long";
    const encrypted = encryptPaymentSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptPaymentSecret(encrypted)).toBe(secret);
  });

  it("rejects malformed merchant credentials", () => {
    expect(() => paymentConfigInput.parse({
      merchantId: "abc",
      apiV3Key: "short",
      certificatePem: "x",
      privateKeyPem: "y",
      enabled: true,
    })).toThrow();
  });
});
