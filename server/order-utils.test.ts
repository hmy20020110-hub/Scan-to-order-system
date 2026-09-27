import { describe, expect, it } from "vitest";
import type { Dish } from "../drizzle/schema";
import { calculateOrderTotal, normalizeOrderItems } from "./order-utils";

const dish = (overrides: Partial<Dish> = {}): Dish => ({
  id: 7,
  categoryId: 2,
  name: "砂锅鸡汤",
  description: "",
  priceCents: 3800,
  imageUrl: null,
  sortOrder: 0,
  isAvailable: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("order utils", () => {
  it("uses the server-side price snapshot when calculating totals", () => {
    const items = normalizeOrderItems([{ dishId: 7, quantity: 2 }], [dish({ priceCents: 3800 })]);
    expect(items[0]).toMatchObject({ dishName: "砂锅鸡汤", unitPriceCents: 3800, quantity: 2 });
    expect(calculateOrderTotal(items)).toBe(7600);
  });

  it("rejects unavailable or unknown dishes", () => {
    expect(() => normalizeOrderItems([{ dishId: 99, quantity: 1 }], [dish()])).toThrow("DISH_UNAVAILABLE");
    expect(() => normalizeOrderItems([{ dishId: 7, quantity: 1 }], [dish({ isAvailable: 0 })])).toThrow("DISH_UNAVAILABLE");
  });

  it("returns zero for an empty normalized list", () => {
    expect(calculateOrderTotal([])).toBe(0);
  });
});
