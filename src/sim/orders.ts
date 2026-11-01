import { ORDERS, orderById } from './data/orders';
import { STRUCTURE_KINDS } from './data/structures';
import type { OrderDef, SimEvent, World } from './types';

export function currentOrder(world: World): OrderDef | null {
  return orderById(world.orders.activeId);
}

export function isSandbox(world: World): boolean {
  return world.orders.activeId === null;
}

export function orderIsComplete(world: World): boolean {
  const order = currentOrder(world);
  if (!order) return false;
  for (const [kind, need] of Object.entries(order.requires)) {
    if ((world.orders.progress.delivered[kind as keyof typeof order.requires] ?? 0) < (need ?? 0)) return false;
  }
  return true;
}

/** Make `id` the active order (or enter sandbox with null): apply unlocks, then allocate stock. */
export function startOrder(world: World, id: string | null, events: SimEvent[]): void {
  world.orders.activeId = id;
  world.orders.offeredIds = id ? [id] : [];
  world.orders.progress = { orderId: id, delivered: {} };
  const order = orderById(id);
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
  allocateStock(world, events);
}

/** Move delivered goods from stock into the active order; complete it if satisfied. */
export function allocateStock(world: World, events: SimEvent[]): void {
  const order = currentOrder(world);
  if (!order) return;
  let progressed = false;
  const delivered = world.orders.progress.delivered;
  for (const [kindRaw, need] of Object.entries(order.requires)) {
    const kind = kindRaw as keyof typeof order.requires;
    const have = delivered[kind] ?? 0;
    const want = (need ?? 0) - have;
    const inStock = world.stock[kind] ?? 0;
    const take = Math.min(want, inStock);
    if (take > 0) {
      delivered[kind] = have + take;
      world.stock[kind] = inStock - take;
      if (world.stock[kind] === 0) delete world.stock[kind];
      progressed = true;
    }
  }
  if (progressed) events.push({ type: 'order_progress', orderId: order.id });
  if (orderIsComplete(world)) {
    world.coins += order.reward;
    world.stats.coinsEarned += order.reward;
    world.orders.completedIds.push(order.id);
    const idx = ORDERS.indexOf(order);
    const next = ORDERS[idx + 1]?.id ?? null;
    events.push({ type: 'order_complete', orderId: order.id, reward: order.reward, final: next === null });
    startOrder(world, next, events);
  }
}
