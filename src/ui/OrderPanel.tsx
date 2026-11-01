import { store } from '../app/store';
import { ITEMS } from '../sim/data/items';
import { ORDERS } from '../sim/data/orders';
import type { ItemKind } from '../sim/types';
import { Icon } from './Icon';

export function OrderPanel() {
  const world = store.sim.world;
  const order = store.order;
  if (!order) {
    return (
      <section className="card orderpanel" aria-label="Orders">
        <h2>
          <Icon k="ui.check" /> All orders done
        </h2>
        <p className="title">Open market</p>
        <p className="sandbox-note">
          Every finished good you deliver now sells for coins. Build as big as you like.
        </p>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.values(ITEMS).map((it) => (
            <span className="chip" key={it.kind}>
              <Icon k={`item.${it.kind}`} size={20} /> {it.value}c
            </span>
          ))}
        </div>
      </section>
    );
  }
  const index = ORDERS.indexOf(order);
  return (
    <section className="card orderpanel" aria-label="Current order" data-testid="order">
      <h2>
        <Icon k="ui.order" /> Order {index + 1} of {ORDERS.length}
      </h2>
      <p className="title">{order.title}</p>
      <p className="customer">for {order.customer}</p>
      <p className="note">“{order.note}”</p>
      {Object.entries(order.requires).map(([kind, need]) => {
        const have = Math.min(need ?? 0, world.orderProgress[kind as ItemKind] ?? 0);
        const done = have >= (need ?? 0);
        return (
          <div className={'req' + (done ? ' done' : '')} key={kind}>
            <Icon k={`item.${kind}`} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="name">{ITEMS[kind as ItemKind].name}</span>
                <span className="count" data-testid={`req-${kind}`}>
                  {have}/{need}
                </span>
              </div>
              <div className="bar" aria-hidden>
                <span style={{ width: `${(100 * have) / (need ?? 1)}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      <div className="reward">
        <span className="progress-label">Reward</span>
        <span className="coin">
          <Icon k="ui.coin" size={20} /> {order.reward}
        </span>
      </div>
      <div className="hint">{order.hint}</div>
    </section>
  );
}
