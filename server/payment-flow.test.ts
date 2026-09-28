import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("order payment input", () => {
  it("accepts the supported on-site payment method through the API contract", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.public.order.create({
      tableCode: "A01",
      paymentMethod: "on_site",
      items: [{ dishId: 1, quantity: 1 }],
    })).rejects.toThrow("数据库尚未连接");
  });

  it("rejects unsupported payment methods before touching the database", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.public.order.create({
      tableCode: "A01",
      paymentMethod: "card" as never,
      items: [{ dishId: 1, quantity: 1 }],
    })).rejects.toThrow();
  });

  it("rejects WeChat callbacks when the merchant has not configured a callback secret", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.payment.callback({
      provider: "wechat",
      signature: "0".repeat(64),
      payload: {
        orderNumber: "TABC1234",
        transactionId: "txn-invalid",
        amountCents: 2680,
        status: "success",
        timestamp: Date.now(),
        nonce: "nonce-12345678",
      },
    })).rejects.toThrow("支付回调密钥尚未配置");
  });

  it("rejects malformed callback payloads at the API boundary", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.payment.callback({
      provider: "wechat",
      signature: "invalid",
      payload: {
        orderNumber: "",
        transactionId: "txn-invalid",
        amountCents: 0,
        status: "success",
        timestamp: Date.now(),
        nonce: "short",
      },
    })).rejects.toThrow();
  });
});
