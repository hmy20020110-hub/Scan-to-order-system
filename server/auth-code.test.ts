import { describe, expect, it } from "vitest";
import { hashMerchantCode, verifyMerchantCode } from "./auth-code";

describe("merchant auth code", () => {
  it("hashes a code without storing the plaintext and verifies it", () => {
    const encoded = hashMerchantCode("20020110");
    expect(encoded).not.toContain("20020110");
    expect(verifyMerchantCode("20020110", encoded)).toBe(true);
    expect(verifyMerchantCode("00000000", encoded)).toBe(false);
  });

  it("rejects malformed or tampered hashes", () => {
    expect(verifyMerchantCode("20020110", "bad-value")).toBe(false);
    const encoded = hashMerchantCode("20020110");
    expect(verifyMerchantCode("20020110", `${encoded}x`)).toBe(false);
  });
});
