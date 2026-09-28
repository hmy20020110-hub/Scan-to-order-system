import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core Manus-auth user table. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  merchantCodeHash: text("merchantCodeHash"),
  merchantLoginFailedAttempts: int("merchantLoginFailedAttempts").default(0).notNull(),
  merchantLoginLockedUntil: timestamp("merchantLoginLockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const restaurants = mysqlTable("restaurants", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  slogan: varchar("slogan", { length: 240 }),
  address: varchar("address", { length: 240 }),
  phone: varchar("phone", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const menuCategories = mysqlTable("menuCategories", {
  id: int("id").autoincrement().primaryKey(),
  restaurantId: int("restaurantId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const dishes = mysqlTable("dishes", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  priceCents: int("priceCents").notNull(),
  imageUrl: text("imageUrl"),
  specifications: text("specifications"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isAvailable: int("isAvailable").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const diningTables = mysqlTable("diningTables", {
  id: int("id").autoincrement().primaryKey(),
  restaurantId: int("restaurantId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  status: mysqlEnum("status", ["available", "occupied", "disabled"])
    .default("available")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  restaurantId: int("restaurantId").notNull(),
  tableId: int("tableId").notNull(),
  orderNumber: varchar("orderNumber", { length: 32 }).notNull().unique(),
  status: mysqlEnum("status", [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "served",
    "cancelled",
  ])
    .default("pending")
    .notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["on_site", "wechat"])
    .default("on_site")
    .notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "pending", "paid", "refunded"])
    .default("unpaid")
    .notNull(),
  totalCents: int("totalCents").notNull(),
  customerNote: text("customerNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  dishId: int("dishId").notNull(),
  dishName: varchar("dishName", { length: 120 }).notNull(),
  unitPriceCents: int("unitPriceCents").notNull(),
  quantity: int("quantity").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Immutable provider callback ledger used for payment idempotency and auditability. */
export const paymentTransactions = mysqlTable(
  "paymentTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: mysqlEnum("provider", ["wechat"]).notNull(),
    orderId: int("orderId").notNull(),
    orderNumber: varchar("orderNumber", { length: 32 }).notNull(),
    transactionId: varchar("transactionId", { length: 128 }).notNull(),
    amountCents: int("amountCents").notNull(),
    status: mysqlEnum("status", ["success", "failed", "refunded"]).notNull(),
    rawPayload: text("rawPayload"),
    processedAt: timestamp("processedAt").defaultNow().notNull(),
  },
  table => ({
    providerTransactionUnique: uniqueIndex("payment_provider_transaction_unique").on(
      table.provider,
      table.transactionId,
    ),
  }),
);

/** Merchant-entered WeChat credentials, encrypted at rest and never returned to the browser. */
export const merchantPaymentConfigs = mysqlTable(
  "merchantPaymentConfigs",
  {
    id: int("id").autoincrement().primaryKey(),
    restaurantId: int("restaurantId").notNull().unique(),
    merchantIdEncrypted: text("merchantIdEncrypted").notNull(),
    apiV3KeyEncrypted: text("apiV3KeyEncrypted").notNull(),
    certificateSerial: varchar("certificateSerial", { length: 64 }),
    certificatePemEncrypted: text("certificatePemEncrypted").notNull(),
    privateKeyPemEncrypted: text("privateKeyPemEncrypted").notNull(),
    enabled: int("enabled").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Restaurant = typeof restaurants.$inferSelect;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type Dish = typeof dishes.$inferSelect;
export type DiningTable = typeof diningTables.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type MerchantPaymentConfig = typeof merchantPaymentConfigs.$inferSelect;
