import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  DiningTable,
  Dish,
  InsertUser,
  MenuCategory,
  Order,
  OrderItem,
  Restaurant,
  dishes,
  diningTables,
  menuCategories,
  orderItems,
  orders,
  restaurants,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getRestaurantByOwner(ownerId: number): Promise<Restaurant | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(restaurants).where(eq(restaurants.ownerId, ownerId)).limit(1);
  return result[0];
}

export async function getRestaurantState(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const restaurant = await getRestaurantByOwner(ownerId);
  if (!restaurant) return null;

  const [categories, tables, recentOrders] = await Promise.all([
    db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.restaurantId, restaurant.id))
      .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.id)),
    db
      .select()
      .from(diningTables)
      .where(eq(diningTables.restaurantId, restaurant.id))
      .orderBy(asc(diningTables.id)),
    db
      .select()
      .from(orders)
      .where(eq(orders.restaurantId, restaurant.id))
      .orderBy(desc(orders.createdAt))
      .limit(100),
  ]);

  const categoryIds = categories.map(category => category.id);
  const menuDishes = categoryIds.length
    ? await db
        .select()
        .from(dishes)
        .where(inArray(dishes.categoryId, categoryIds))
        .orderBy(asc(dishes.sortOrder), asc(dishes.id))
    : [];

  const orderIds = recentOrders.map(order => order.id);
  const items = orderIds.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
    : [];

  return { restaurant, categories, dishes: menuDishes, tables, orders: recentOrders, orderItems: items };
}

export async function getPublicMenuByTable(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const tableRows = await db.select().from(diningTables).where(eq(diningTables.code, code)).limit(1);
  const table = tableRows[0];
  if (!table || table.status === "disabled") return null;

  const restaurantRows = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, table.restaurantId))
    .limit(1);
  const restaurant = restaurantRows[0];
  if (!restaurant) return null;

  const categories = await db
    .select()
    .from(menuCategories)
    .where(and(eq(menuCategories.restaurantId, restaurant.id), eq(menuCategories.isActive, 1)))
    .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.id));
  const categoryIds = categories.map(category => category.id);
  const menuDishes = categoryIds.length
    ? await db
        .select()
        .from(dishes)
        .where(and(inArray(dishes.categoryId, categoryIds), eq(dishes.isAvailable, 1)))
        .orderBy(asc(dishes.sortOrder), asc(dishes.id))
    : [];

  return { restaurant, table, categories, dishes: menuDishes };
}

export async function getDishesByIds(ids: number[]): Promise<Dish[]> {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  return db.select().from(dishes).where(inArray(dishes.id, ids));
}

export async function insertOrderWithItems(params: {
  restaurantId: number;
  tableId: number;
  orderNumber: string;
  paymentMethod: "on_site" | "wechat";
  totalCents: number;
  customerNote?: string;
  items: Array<{ dishId: number; dishName: string; unitPriceCents: number; quantity: number; note?: string }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db.transaction(async tx => {
    const inserted = await tx.insert(orders).values({
      restaurantId: params.restaurantId,
      tableId: params.tableId,
      orderNumber: params.orderNumber,
      paymentMethod: params.paymentMethod,
      totalCents: params.totalCents,
      customerNote: params.customerNote || null,
      status: "pending",
      paymentStatus: "unpaid",
    });
    const orderId = Number(inserted[0].insertId);
    await tx.insert(orderItems).values(
      params.items.map(item => ({
        orderId,
        dishId: item.dishId,
        dishName: item.dishName,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        note: item.note || null,
      })),
    );
    await tx
      .update(diningTables)
      .set({ status: "occupied" })
      .where(eq(diningTables.id, params.tableId));
    return orderId;
  });
}

export async function findOrderByNumber(orderNumber: string): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  return rows[0];
}

export async function updateOrderStatusByOwner(ownerId: number, orderId: number, status: Order["status"]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const restaurant = await getRestaurantByOwner(ownerId);
  if (!restaurant) return false;
  const target = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurant.id)))
    .limit(1);
  if (!target[0]) return false;
  await db.update(orders).set({ status }).where(eq(orders.id, orderId));
  if (status === "served" || status === "cancelled") {
    await db.update(diningTables).set({ status: "available" }).where(eq(diningTables.id, target[0].tableId));
  }
  return true;
}

export async function updateOrderPaymentStatusByOwner(
  ownerId: number,
  orderId: number,
  paymentStatus: Order["paymentStatus"],
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const restaurant = await getRestaurantByOwner(ownerId);
  if (!restaurant) return false;
  const target = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurant.id)))
    .limit(1);
  if (!target[0]) return false;
  await db.update(orders).set({ paymentStatus }).where(eq(orders.id, orderId));
  return true;
}

export type AdminState = Awaited<ReturnType<typeof getRestaurantState>>;
export type PublicMenu = Awaited<ReturnType<typeof getPublicMenuByTable>>;
export type { DiningTable, Dish, MenuCategory, Order, OrderItem, Restaurant };
