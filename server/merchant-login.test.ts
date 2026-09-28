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
  it("rejects malformed codes before authentication without touching the database", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auth.merchantLogin({ code: "abc" })).rejects.toThrow();
  });
});
