import { z } from "zod";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import {
  diningTables,
  dishes,
  menuCategories,
  restaurants,
} from "../drizzle/schema";
import {
  findOrderByNumber,
  getDb,
  getUserByOpenId,
  getPublicMenuByTable,
  getRestaurantByOwner,
  getRestaurantState,
  insertOrderWithItems,
  updateOrderPaymentStatusByOwner,
  updateOrderStatusByOwner,
} from "./db";
import { TRPCError } from "@trpc/server";
import { calculateOrderTotal, normalizeOrderItems } from "./order-utils";

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
      .input(z.object({ code: z.string().regex(/^\d{8}$/, "请输入 8 位数字登录码") }))
      .mutation(async ({ ctx, input }) => {
        if (input.code !== ENV.merchantLoginCode) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "登录码不正确" });
        }
        if (!ENV.ownerOpenId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "商家账号尚未配置" });
        }
        const owner = await getUserByOpenId(ENV.ownerOpenId);
        if (!owner || owner.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "商家管理员账号尚未初始化" });
        }
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

  admin: router({
    state: adminOnly.query(async ({ ctx }) => getRestaurantState(ctx.user.id)),
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
          isAvailable: 1,
          sortOrder: 0,
        });
        return { id: Number(result[0].insertId) };
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
  }),
});

export type AppRouter = typeof appRouter;
