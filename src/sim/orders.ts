import { ORDERS } from './data/orders';
import { STRUCTURE_KINDS } from './data/structures';
import type { OrderDef, SimEvent, World } from './types';

export function currentOrder(world: World): OrderDef | null {
  return ORDERS[world.orderIndex] ?? null;
}

export function isSandbox(world: World): boolean {
  return world.orderIndex >= ORDERS.length;
}

export function orderIsComplete(world: World): boolean {
  const order = currentOrder(world);
  if (!order) return false;
  for (const [kind, need] of Object.entries(order.requires)) {
    if ((world.orderProgress[kind as keyof typeof world.orderProgress] ?? 0) < (need ?? 0)) return false;
  }
  return true;
}

/** Make the order at world.orderIndex active: apply its unlocks, then allocate any stock. */
export function startCurrentOrder(world: World, events: SimEvent[]): void {
  const order = currentOrder(world);
  if (!order) {
    // Sandbox: everything opens up.
    const newly = STRUCTURE_KINDS.filter((k) => !world.unlocked.includes(k));
    world.unlocked = [...STRUCTURE_KINDS];
    const exp = !world.expansionUnlocked;
    world.expansionUnlocked = true;
    if (newly.length || exp) events.push({ type: 'unlocked', kinds: newly, expansion: exp });
    events.push({ type: 'all_orders_complete' });
    return;
  }
  const newly = order.unlocks.filter((k) => !world.unlocked.includes(k));
  for (const k of newly) world.unlocked.push(k);
  const exp = !!order.unlocksExpansion && !world.expansionUnlocked;
  if (exp) world.expansionUnlocked = true;
  if (newly.length || exp) events.push({ type: 'unlocked', kinds: newly, expansion: exp });
  world.orderProgress = {};
  allocateStock(world, events);
}

/** Move delivered goods from stock into the active order; complete it if satisfied. */
export function allocateStock(world: World, events: SimEvent[]): void {
  const order = currentOrder(world);
  if (!order) return;
  let progressed = false;
  for (const [kindRaw, need] of Object.entries(order.requires)) {
    const kind = kindRaw as keyof typeof order.requires;
    const have = world.orderProgress[kind] ?? 0;
    const want = (need ?? 0) - have;
    const inStock = world.stock[kind] ?? 0;
    const take = Math.min(want, inStock);
    if (take > 0) {
      world.orderProgress[kind] = have + take;
      world.stock[kind] = inStock - take;
      if (world.stock[kind] === 0) delete world.stock[kind];
      progressed = true;
    }
  }
  if (progressed) events.push({ type: 'order_progress', orderId: order.id });
  if (orderIsComplete(world)) {
    world.coins += order.reward;
    world.stats.coinsEarned += order.reward;
    world.completedOrders.push(order.id);
    world.orderIndex += 1;
    events.push({ type: 'order_complete', orderId: order.id, reward: order.reward });
    startCurrentOrder(world, events);
  }
}
