import { describe, expect, it } from "vitest";
import {
  createPaymentSignature,
  resolveOrderPaymentStatus,
  validatePaymentCallback,
} from "./payment-callbacks";

const secret = "test-payment-secret";
const nowMs = 1_700_000_000_000;
const payload = {
  orderNumber: "TABC1234",
  transactionId: "txn-001",
  amountCents: 2680,
  status: "success" as const,
  timestamp: nowMs,
  nonce: "nonce-12345678",
};

describe("payment callback contract", () => {
  it("maps callback states without turning a failed callback into paid", () => {
    expect(resolveOrderPaymentStatus("success", "unpaid")).toBe("paid");
    expect(resolveOrderPaymentStatus("failed", "unpaid")).toBe("unpaid");
    expect(resolveOrderPaymentStatus("failed", "pending")).toBe("pending");
    expect(resolveOrderPaymentStatus("refunded", "paid")).toBe("refunded");
  });

  it.each(["mock", "wechat"] as const)("accepts a signed %s callback", provider => {
    const signature = createPaymentSignature(provider, payload, secret);
    expect(validatePaymentCallback({ provider, payload, signature, secret, nowMs })).toEqual(payload);
  });

  it("rejects a changed amount or signature", () => {
    const signature = createPaymentSignature("mock", payload, secret);
    expect(() => validatePaymentCallback({
      provider: "mock",
      payload: { ...payload, amountCents: 1 },
      signature,
      secret,
      nowMs,
    })).toThrow("PAYMENT_CALLBACK_SIGNATURE_INVALID");
  });

  it("rejects expired callbacks and wrong providers", () => {
    const signature = createPaymentSignature("wechat", payload, secret);
    expect(() => validatePaymentCallback({
      provider: "wechat",
      payload,
      signature,
      secret,
      nowMs: nowMs + 5 * 60 * 1000 + 1,
    })).toThrow("PAYMENT_CALLBACK_EXPIRED");
    expect(() => validatePaymentCallback({
      provider: "mock",
      payload,
      signature,
      secret,
      nowMs,
    })).toThrow("PAYMENT_CALLBACK_SIGNATURE_INVALID");
  });
});
