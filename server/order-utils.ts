import type { Dish } from "../drizzle/schema";

export type OrderItemInput = {
  dishId: number;
  quantity: number;
  note?: string;
};

export type NormalizedOrderItem = {
  dishId: number;
  dishName: string;
  unitPriceCents: number;
  quantity: number;
  note?: string;
};

/** Build immutable order snapshots from the current server-side menu. */
export function normalizeOrderItems(input: OrderItemInput[], availableDishes: Dish[]): NormalizedOrderItem[] {
  const dishMap = new Map(availableDishes.map(dish => [dish.id, dish]));
  return input.map(item => {
    const dish = dishMap.get(item.dishId);
    if (!dish || dish.isAvailable !== 1) {
      throw new Error("DISH_UNAVAILABLE");
    }
    return {
      dishId: dish.id,
      dishName: dish.name,
      unitPriceCents: dish.priceCents,
      quantity: item.quantity,
      note: item.note,
    };
  });
}

export function calculateOrderTotal(items: NormalizedOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}
