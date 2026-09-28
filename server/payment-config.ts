import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ENV } from "./_core/env";

const VERSION = "v1";

export const paymentConfigInput = z.object({
  merchantId: z.string().trim().regex(/^\d{6,32}$/, "商户号应为 6-32 位数字"),
  apiV3Key: z.string().trim().min(16).max(128),
  certificateSerial: z.string().trim().max(64).optional().or(z.literal("")),
  certificatePem: z.string().trim().min(64).max(30000),
  privateKeyPem: z.string().trim().min(64).max(30000),
  enabled: z.boolean().default(false),
});

export type PaymentConfigInput = z.infer<typeof paymentConfigInput>;

function encryptionKey() {
  if (ENV.cookieSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters before saving payment credentials");
  }
  return createHash("sha256").update(`scan-ordering/payment-config:${ENV.cookieSecret}`).digest();
}

export function encryptPaymentSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptPaymentSecret(value: string) {
  const [version, ivText, tagText, ciphertextText] = value.split(".");
  if (version !== VERSION || !ivText || !tagText || !ciphertextText) throw new Error("Invalid payment credential format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}

export function maskPaymentSecret(value: string | null | undefined) {
  if (!value) return null;
  return `${value.slice(0, 3)}${"•".repeat(Math.max(3, Math.min(12, value.length - 3)))}`;
}
