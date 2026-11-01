import { store } from '../app/store';
import { ITEMS } from '../sim/data/items';
import { ORDERS } from '../sim/data/orders';
import type { ItemKind } from '../sim/types';
import { Icon } from './Icon';
import { fmt, S } from './strings';

export function OrderPanel() {
  const world = store.sim.world;
  const order = store.order;
  if (!order) {
    return (
      <section className="card orderpanel" aria-label={S.a11y.order} data-testid="order-sandbox">
        <h2>
          <Icon k="ui.check" /> {S.hud.sandboxTitle}
        </h2>
        <p className="sandbox-note">{S.hud.sandboxBody}</p>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.values(ITEMS).map((it) => (
            <span className="chip" key={it.kind} title={it.name}>
              <Icon k={`item.${it.kind}`} size={20} /> {it.value}
              <Icon k="ui.coin" size={14} />
            </span>
          ))}
        </div>
      </section>
    );
  }
  const index = ORDERS.indexOf(order);
  const delivered = world.orders.progress.delivered;
  return (
    <section className="card orderpanel" aria-label={S.a11y.order} data-testid="order">
      <h2>
        <Icon k="ui.order" /> {fmt(S.hud.orderOf, { n: index + 1, total: ORDERS.length })}
      </h2>
      <p className="title">{order.title}</p>
      <p className="customer">{fmt(S.hud.forCustomer, { customer: order.customer })}</p>
      <p className="note">“{order.note}”</p>
      <div aria-live="polite" aria-atomic="true">
        {Object.entries(order.requires).map(([kind, need]) => {
          const have = Math.min(need ?? 0, delivered[kind as ItemKind] ?? 0);
          const done = have >= (need ?? 0);
          return (
            <div className={'req' + (done ? ' done' : '')} key={kind} aria-label={`${ITEMS[kind as ItemKind].plural}: ${fmt(S.hud.orderDelivered, { have, need: need ?? 0 })}`}>
              <Icon k={`item.${kind}`} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="name">{ITEMS[kind as ItemKind].plural}</span>
                  <span className="count" data-testid={`req-${kind}`}>
                    {have} / {need}
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
        <span className="progress-label">{S.hud.reward}</span>
        <span className="coin">
          <Icon k="ui.coin" size={20} /> {order.reward}
        </span>
      </div>
      <div className="hint">{order.hint}</div>
    </section>
  );
}
