import { z } from "zod";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { hashMerchantCode, MERCHANT_CODE_PATTERN, verifyMerchantCode } from "./auth-code";
import {
  diningTables,
  dishes,
  menuCategories,
  restaurants,
} from "../drizzle/schema";
import {
  applyPaymentCallback,
  findOrderByNumber,
  getDb,
  getUserByOpenId,
  getPublicMenuByTable,
  getRestaurantByOwner,
  getSalesAnalytics,
  getRestaurantState,
  insertOrderWithItems,
  updateMerchantLoginState,
  updateOrderPaymentStatusByOwner,
  updateOrderStatusByOwner,
} from "./db";
import { TRPCError } from "@trpc/server";
import { calculateOrderTotal, normalizeOrderItems } from "./order-utils";
import {
  paymentCallbackInputSchema,
  validatePaymentCallback,
} from "./payment-callbacks";
import { storagePut } from "./storage";

const restaurantInput = z.object({
  name: z.string().trim().min(1, "请输入门店名称").max(120),
  slogan: z.string().trim().max(240).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

const adminOnly = adminProcedure;

function requireDatabase<T>(value: T | null | undefined): T {
  if (!value) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库尚未连接" });
  return value;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    merchantLogin: publicProcedure
      .input(z.object({ code: z.string().regex(MERCHANT_CODE_PATTERN, "请输入 8 位数字登录码") }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.ownerOpenId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "商家账号尚未配置" });
        }
        const owner = await getUserByOpenId(ENV.ownerOpenId);
        if (!owner || owner.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "商家管理员账号尚未初始化" });
        }
        const now = new Date();
        if (owner.merchantLoginLockedUntil && owner.merchantLoginLockedUntil.getTime() > now.getTime()) {
          const seconds = Math.ceil((owner.merchantLoginLockedUntil.getTime() - now.getTime()) / 1000);
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `登录已锁定，请 ${seconds} 秒后重试` });
        }
        const valid = owner.merchantCodeHash
          ? verifyMerchantCode(input.code, owner.merchantCodeHash)
          : input.code === ENV.merchantLoginCode;
        if (!valid) {
          const attempts = owner.merchantLoginFailedAttempts + 1;
          const lockedUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null;
          await updateMerchantLoginState(ENV.ownerOpenId, { merchantLoginFailedAttempts: attempts, merchantLoginLockedUntil: lockedUntil });
          if (lockedUntil) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "连续 5 次输入错误，登录已锁定 15 分钟" });
          throw new TRPCError({ code: "UNAUTHORIZED", message: `登录码不正确，还可尝试 ${5 - attempts} 次` });
        }
        await updateMerchantLoginState(ENV.ownerOpenId, {
          merchantCodeHash: owner.merchantCodeHash ?? hashMerchantCode(input.code),
          merchantLoginFailedAttempts: 0,
          merchantLoginLockedUntil: null,
        });
        const token = await sdk.createSessionToken(ENV.ownerOpenId, { name: owner.name ?? "门店管理员" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 1000 * 60 * 60 * 24 * 30 });
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  public: router({
    menu: publicProcedure
      .input(z.object({ tableCode: z.string().trim().min(1).max(40) }))
      .query(async ({ input }) => {
        const menu = await getPublicMenuByTable(input.tableCode);
        if (!menu) throw new TRPCError({ code: "NOT_FOUND", message: "桌台二维码无效或已停用" });
        return menu;
      }),
    order: router({
      create: publicProcedure
        .input(
          z.object({
            tableCode: z.string().trim().min(1).max(40),
            items: z
              .array(
                z.object({
                  dishId: z.number().int().positive(),
                  quantity: z.number().int().min(1).max(99),
                  note: z.string().trim().max(200).optional().or(z.literal("")),
                  specs: z.array(z.object({ group: z.string().trim().min(1).max(80), option: z.string().trim().min(1).max(80) })).max(20).optional(),
                }),
              )
              .min(1, "购物车不能为空"),
            paymentMethod: z.enum(["on_site", "wechat"]).default("on_site"),
            customerNote: z.string().trim().max(500).optional().or(z.literal("")),
          }),
        )
        .mutation(async ({ input }) => {
          const menu = requireDatabase(await getPublicMenuByTable(input.tableCode));
          let normalizedItems;
          try {
            normalizedItems = normalizeOrderItems(input.items, menu.dishes);
          } catch {
            throw new TRPCError({ code: "BAD_REQUEST", message: "部分菜品已下架，请刷新菜单" });
          }
          const totalCents = calculateOrderTotal(normalizedItems);
          const orderNumber = `T${Date.now().toString(36).slice(-5).toUpperCase()}${nanoid(4).toUpperCase()}`;
          await insertOrderWithItems({
            restaurantId: menu.restaurant.id,
            tableId: menu.table.id,
            orderNumber,
            paymentMethod: input.paymentMethod,
            totalCents,
            customerNote: input.customerNote,
            items: normalizedItems,
          });
          return {
            orderNumber,
            totalCents,
            tableName: menu.table.name,
            paymentMethod: input.paymentMethod,
            paymentStatus: "unpaid" as const,
          };
        }),
      getByNumber: publicProcedure
        .input(z.object({ orderNumber: z.string().trim().min(1).max(32) }))
        .query(async ({ input }) => {
          const order = await findOrderByNumber(input.orderNumber);
          if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
          return order;
      }),
    }),
  }),

  payment: router({
    /** Public callback contract used by the mock provider and the WeChat adapter. */
    callback: publicProcedure
      .input(paymentCallbackInputSchema)
      .mutation(async ({ input }) => {
        const secret =
          input.provider === "wechat"
            ? ENV.wechatPaymentCallbackSecret
            : ENV.mockPaymentCallbackSecret;
        if (!secret || (ENV.isProduction && input.provider === "mock" && secret === "local-mock-payment-secret")) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "支付回调密钥尚未配置" });
        }
        let payload;
        try {
          payload = validatePaymentCallback({
            provider: input.provider,
            payload: input.payload,
            signature: input.signature,
            secret,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "PAYMENT_CALLBACK_INVALID";
          const code = message === "PAYMENT_CALLBACK_EXPIRED" ? "BAD_REQUEST" : "UNAUTHORIZED";
          throw new TRPCError({ code, message: "支付回调签名或时效校验失败" });
        }
        try {
          return await applyPaymentCallback({ provider: input.provider, payload });
        } catch (error) {
          const message = error instanceof Error ? error.message : "PAYMENT_CALLBACK_FAILED";
          const code = message === "PAYMENT_ORDER_NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST";
          throw new TRPCError({ code, message: "支付回调未能更新订单" });
        }
      }),
  }),

  admin: router({
    state: adminOnly.query(async ({ ctx }) => getRestaurantState(ctx.user.id)),
    salesAnalytics: adminOnly
      .input(z.object({ days: z.number().int().min(1).max(90).default(30) }))
      .query(({ ctx, input }) => getSalesAnalytics(ctx.user.id, input.days)),
    createRestaurant: adminOnly.input(restaurantInput).mutation(async ({ ctx, input }) => {
      const db = requireDatabase(await getDb());
      const existing = await getRestaurantByOwner(ctx.user.id);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "门店已经创建" });
      const result = await db.insert(restaurants).values({
        ownerId: ctx.user.id,
        name: input.name,
        slogan: input.slogan || null,
        address: input.address || null,
        phone: input.phone || null,
      });
      return { id: Number(result[0].insertId) };
    }),
    updateRestaurant: adminOnly
      .input(restaurantInput)
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const restaurant = await getRestaurantByOwner(ctx.user.id);
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "请先完成门店设置" });
        await db.update(restaurants).set({
          name: input.name,
          slogan: input.slogan || null,
          address: input.address || null,
          phone: input.phone || null,
        }).where(eq(restaurants.id, restaurant.id));
        return { success: true } as const;
      }),
    createCategory: adminOnly
      .input(z.object({ name: z.string().trim().min(1).max(80), sortOrder: z.number().int().default(0) }))
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const restaurant = await getRestaurantByOwner(ctx.user.id);
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "请先完成门店设置" });
        const result = await db.insert(menuCategories).values({
          restaurantId: restaurant.id,
          name: input.name,
          sortOrder: input.sortOrder,
          isActive: 1,
        });
        return { id: Number(result[0].insertId) };
      }),
    createDish: adminOnly
      .input(
        z.object({
          categoryId: z.number().int().positive(),
          name: z.string().trim().min(1).max(120),
          description: z.string().trim().max(1000).optional().or(z.literal("")),
          priceCents: z.number().int().positive().max(99999999),
          imageUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
          specifications: z.string().trim().max(5000).optional().or(z.literal("")),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const restaurant = await getRestaurantByOwner(ctx.user.id);
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "请先完成门店设置" });
        const category = await db.select().from(menuCategories).where(
          and(eq(menuCategories.id, input.categoryId), eq(menuCategories.restaurantId, restaurant.id)),
        ).limit(1);
        if (!category[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "菜品分类不存在" });
        const result = await db.insert(dishes).values({
          categoryId: input.categoryId,
          name: input.name,
          description: input.description || null,
          priceCents: input.priceCents,
          imageUrl: input.imageUrl || null,
          specifications: input.specifications || null,
          isAvailable: 1,
          sortOrder: 0,
        });
        return { id: Number(result[0].insertId) };
      }),
    uploadDishImage: adminOnly
      .input(z.object({ fileName: z.string().trim().max(120), dataUrl: z.string().max(7000000) }))
      .mutation(async ({ ctx, input }) => {
        const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
        if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "只支持 PNG、JPG、WEBP 或 GIF 图片" });
        const contentType = match[1];
        const data = Buffer.from(match[2], "base64");
        if (data.length === 0 || data.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "图片大小需在 5MB 以内" });
        }
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "dish-image";
        try {
          return await storagePut(`dishes/${ctx.user.id}/${Date.now()}-${safeName}`, data, contentType);
        } catch (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "图片上传失败" });
        }
      }),
    setDishAvailability: adminOnly
      .input(z.object({ dishId: z.number().int().positive(), isAvailable: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const restaurant = await getRestaurantByOwner(ctx.user.id);
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "请先完成门店设置" });
        const categoryIds = await db.select({ id: menuCategories.id }).from(menuCategories).where(eq(menuCategories.restaurantId, restaurant.id));
        const dish = await db.select().from(dishes).where(eq(dishes.id, input.dishId)).limit(1);
        if (!dish[0] || !categoryIds.some(category => category.id === dish[0].categoryId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "无权操作此菜品" });
        }
        await db.update(dishes).set({ isAvailable: input.isAvailable ? 1 : 0 }).where(eq(dishes.id, input.dishId));
        return { success: true } as const;
      }),
    createTable: adminOnly
      .input(z.object({ name: z.string().trim().min(1).max(80), code: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/, "桌台码只能包含字母、数字、下划线和短横线") }))
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const restaurant = await getRestaurantByOwner(ctx.user.id);
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "请先完成门店设置" });
        const existing = await db.select().from(diningTables).where(eq(diningTables.code, input.code)).limit(1);
        if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "桌台码已存在" });
        const result = await db.insert(diningTables).values({ restaurantId: restaurant.id, name: input.name, code: input.code, status: "available" });
        return { id: Number(result[0].insertId) };
      }),
      updateOrderStatus: adminOnly
      .input(z.object({ orderId: z.number().int().positive(), status: z.enum(["pending", "confirmed", "preparing", "ready", "served", "cancelled"]) }))
      .mutation(async ({ ctx, input }) => {
        const updated = await updateOrderStatusByOwner(ctx.user.id, input.orderId, input.status);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
        return { success: true } as const;
      }),
    updateOrderPaymentStatus: adminOnly
      .input(z.object({ orderId: z.number().int().positive(), paymentStatus: z.enum(["unpaid", "pending", "paid", "refunded"]) }))
      .mutation(async ({ ctx, input }) => {
        const updated = await updateOrderPaymentStatusByOwner(ctx.user.id, input.orderId, input.paymentStatus);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
        return { success: true } as const;
      }),
    changeMerchantLoginCode: adminOnly
      .input(z.object({ currentCode: z.string().regex(MERCHANT_CODE_PATTERN, "原登录码必须是 8 位数字"), newCode: z.string().regex(MERCHANT_CODE_PATTERN, "新登录码必须是 8 位数字") }))
      .mutation(async ({ ctx, input }) => {
        const owner = await getUserByOpenId(ctx.user.openId);
        if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "商家账号不存在" });
        const currentValid = owner.merchantCodeHash
          ? verifyMerchantCode(input.currentCode, owner.merchantCodeHash)
          : input.currentCode === ENV.merchantLoginCode;
        if (!currentValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "原登录码不正确" });
        if (input.currentCode === input.newCode) throw new TRPCError({ code: "BAD_REQUEST", message: "新登录码不能与原登录码相同" });
        await updateMerchantLoginState(ctx.user.openId, {
          merchantCodeHash: hashMerchantCode(input.newCode),
          merchantLoginFailedAttempts: 0,
          merchantLoginLockedUntil: null,
        });
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
