import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { TRPCError } from "@trpc/server";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";

function assertProductionConfig() {
  if (!ENV.isProduction) return;
  const missing = [
    ["DATABASE_URL", ENV.databaseUrl],
    ["JWT_SECRET", ENV.cookieSecret],
    ["OWNER_OPEN_ID", ENV.ownerOpenId],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (ENV.cookieSecret.length < 32) missing.push("JWT_SECRET(至少32字符)");
  if (missing.length > 0) {
    throw new Error(`生产配置不完整，请填写：${missing.join("、")}`);
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  assertProductionConfig();
  const app = express();
  const server = createServer(app);
  // Keep unauthenticated request parsing bounded; 7MB base64 images fit within 8MB.
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/payment-callbacks/:provider", async (req, res) => {
    const provider = req.params.provider;
    if (provider !== "wechat") {
      res.status(404).json({ success: false, message: "支付渠道不存在" });
      return;
    }
    try {
      const result = await appRouter.createCaller({
        user: null,
        req,
        res,
      }).payment.callback({
        provider,
        signature: req.header("x-payment-signature") ?? "",
        payload: req.body,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      const code = error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR";
      const status = code === "UNAUTHORIZED" ? 401 : code === "NOT_FOUND" ? 404 : code === "BAD_REQUEST" ? 400 : code === "PRECONDITION_FAILED" ? 412 : 500;
      res.status(status).json({ success: false, message: error instanceof Error ? error.message : "支付回调处理失败" });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
