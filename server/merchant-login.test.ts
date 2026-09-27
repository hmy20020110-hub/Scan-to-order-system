import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("auth.merchantLogin", () => {
  it("rejects a wrong merchant code", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auth.merchantLogin({ code: "00000000" })).rejects.toThrow("登录码不正确");
  });

  it("rejects malformed codes before authentication", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auth.merchantLogin({ code: "abc" })).rejects.toThrow();
  });
});
