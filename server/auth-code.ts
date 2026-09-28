import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const MERCHANT_CODE_PATTERN = /^\d{8}$/;

export function hashMerchantCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(code, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyMerchantCode(code: string, encoded: string): boolean {
  const [salt, expectedHex] = encoded.split(":");
  if (!salt || !expectedHex || expectedHex.length !== 128) return false;
  const actual = scryptSync(code, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
