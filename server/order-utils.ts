import type { Dish } from "../drizzle/schema";

export type OrderItemInput = {
  dishId: number;
  quantity: number;
  note?: string;
  specs?: Array<{ group: string; option: string }>;
};

export type DishSpecificationGroup = {
  name: string;
  options: Array<{ name: string; priceDeltaCents: number }>;
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
    const groups = parseDishSpecifications(dish.specifications);
    const selected = item.specs ?? [];
    const selectedGroups = new Set<string>();
    let specPriceDelta = 0;
    const selectedLabels: string[] = [];
    for (const selection of selected) {
      if (selectedGroups.has(selection.group)) throw new Error("INVALID_DISH_SPECIFICATION");
      const group = groups.find(candidate => candidate.name === selection.group);
      const option = group?.options.find(candidate => candidate.name === selection.option);
      if (!group || !option) throw new Error("INVALID_DISH_SPECIFICATION");
      selectedGroups.add(selection.group);
      specPriceDelta += option.priceDeltaCents;
      selectedLabels.push(`${group.name}：${option.name}`);
    }
    if (groups.some(group => group.options.length > 0 && !selectedGroups.has(group.name))) {
      throw new Error("INVALID_DISH_SPECIFICATION");
    }
    return {
      dishId: dish.id,
      dishName: dish.name,
      unitPriceCents: dish.priceCents + specPriceDelta,
      quantity: item.quantity,
      note: [item.note, selectedLabels.length ? selectedLabels.join(" / ") : ""].filter(Boolean).join(" · ") || undefined,
    };
  });
}

export function parseDishSpecifications(value: string | null | undefined): DishSpecificationGroup[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((group): group is DishSpecificationGroup => Boolean(
      group && typeof group === "object" && typeof (group as DishSpecificationGroup).name === "string" &&
      Array.isArray((group as DishSpecificationGroup).options),
    )).map(group => ({
      name: group.name,
      options: group.options.filter(option => Boolean(
        option && typeof option === "object" && typeof option.name === "string" && Number.isInteger(option.priceDeltaCents),
      )),
    }));
  } catch {
    return [];
  }
}

export function calculateOrderTotal(items: NormalizedOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}
