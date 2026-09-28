import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const paymentProviderSchema = z.enum(["wechat"]);
export const paymentCallbackPayloadSchema = z.object({
  orderNumber: z.string().trim().min(1).max(32),
  transactionId: z.string().trim().min(1).max(128),
  amountCents: z.number().int().positive(),
  status: z.enum(["success", "failed", "refunded"]),
  timestamp: z.number().int().positive(),
  nonce: z.string().trim().min(8).max(128),
});

export type PaymentProvider = z.infer<typeof paymentProviderSchema>;
export type PaymentCallbackPayload = z.infer<typeof paymentCallbackPayloadSchema>;
export type OrderPaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

export function resolveOrderPaymentStatus(
  callbackStatus: PaymentCallbackPayload["status"],
  currentStatus: OrderPaymentStatus,
): OrderPaymentStatus {
  if (callbackStatus === "success") return "paid";
  if (callbackStatus === "refunded") return "refunded";
  return currentStatus;
}

function signingMessage(provider: PaymentProvider, payload: PaymentCallbackPayload) {
  return [
    provider,
    payload.orderNumber,
    payload.transactionId,
    payload.amountCents,
    payload.status,
    payload.timestamp,
    payload.nonce,
  ].join("\n");
}

/** Testable signature contract for the configured WeChat adapter. */
export function createPaymentSignature(
  provider: PaymentProvider,
  payload: PaymentCallbackPayload,
  secret: string,
) {
  return createHmac("sha256", secret).update(signingMessage(provider, payload)).digest("hex");
}

export function verifyPaymentSignature(
  provider: PaymentProvider,
  payload: PaymentCallbackPayload,
  signature: string,
  secret: string,
) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createPaymentSignature(provider, payload, secret);
  const received = Buffer.from(signature, "hex");
  const calculated = Buffer.from(expected, "hex");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

export function validatePaymentCallback(params: {
  provider: PaymentProvider;
  payload: unknown;
  signature: string;
  secret: string;
  nowMs?: number;
  maxAgeMs?: number;
}) {
  const payload = paymentCallbackPayloadSchema.parse(params.payload);
  const nowMs = params.nowMs ?? Date.now();
  const maxAgeMs = params.maxAgeMs ?? 5 * 60 * 1000;
  if (Math.abs(nowMs - payload.timestamp) > maxAgeMs) {
    throw new Error("PAYMENT_CALLBACK_EXPIRED");
  }
  if (!verifyPaymentSignature(params.provider, payload, params.signature, params.secret)) {
    throw new Error("PAYMENT_CALLBACK_SIGNATURE_INVALID");
  }
  return payload;
}

export const paymentCallbackInputSchema = z.object({
  provider: paymentProviderSchema,
  signature: z.string().trim().min(1).max(128),
  payload: paymentCallbackPayloadSchema,
});
