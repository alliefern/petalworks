import { store } from '../app/store';
import { ITEMS } from '../sim/data/items';
import { ORDERS } from '../sim/data/orders';
import type { ItemKind } from '../sim/types';
import { Icon } from './Icon';
import { COPY, EXTRA, fmt, itemName, orderCopy } from './strings';

export function OrderPanel() {
  const world = store.sim.world;
  const order = store.order;
  if (!order) {
    return (
      <section className="card orderpanel" aria-label={COPY.ending.sandbox} data-testid="order-sandbox">
        <h2>
          <Icon k="ui.check" /> {COPY.ending.sandbox}
        </h2>
        <p className="sandbox-note">{EXTRA.hud.sandboxBody}</p>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.values(ITEMS).map((it) => (
            <span className="chip" key={it.kind} title={itemName(it.kind)}>
              <Icon k={`item.${it.kind}`} size={20} /> {it.value}
              <Icon k="ui.coin" size={14} />
            </span>
          ))}
        </div>
      </section>
    );
  }
  const oc = orderCopy(order.id);
  const index = ORDERS.indexOf(order);
  const delivered = world.orders.progress.delivered;
  const summary = fmt(COPY.a11y.orderSummary, { customer: oc.customer, short: oc.short, coins: order.reward, note: oc.note });
  return (
    <section className="card orderpanel" aria-label={fmt(COPY.a11y.order, { summary })} data-testid="order">
      <h2>
        <Icon k="ui.order" /> {fmt(EXTRA.hud.orderOf, { n: index + 1, total: ORDERS.length })}
      </h2>
      <p className="title">{oc.requirement}</p>
      <p className="customer">
        {COPY.orders.labels.from} {oc.customer}
      </p>
      <p className="note">“{oc.note}”</p>
      <div aria-live="polite" aria-atomic="true">
        {Object.entries(order.requires).map(([kind, need]) => {
          const have = Math.min(need ?? 0, delivered[kind as ItemKind] ?? 0);
          const done = have >= (need ?? 0);
          return (
            <div className={'req' + (done ? ' done' : '')} key={kind} aria-label={`${itemName(kind as ItemKind, 2)}: ${fmt(COPY.hud.orderDelivered, { have, need: need ?? 0 })}`}>
              <Icon k={`item.${kind}`} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="name">{itemName(kind as ItemKind, need ?? 1)}</span>
                  <span className="count" data-testid={`req-${kind}`}>
                    {fmt(COPY.hud.orderProgress, { have, need: need ?? 0 })}
                  </span>
                </div>
                <div className="bar" aria-hidden>
                  <span style={{ width: `${(100 * have) / (need ?? 1)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="reward">
        <span className="progress-label">{COPY.orders.labels.reward}</span>
        <span className="coin">
          <Icon k="ui.coin" size={20} /> {fmt(oc.reward, { coins: order.reward })}
        </span>
      </div>
    </section>
  );
}
