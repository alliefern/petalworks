import { store } from '../app/store';
import { orderById } from '../sim/data/orders';
import { Icon } from './Icon';
import { fmt, S } from './strings';

/** A short non-modal beat after an order packs. The sim holds for a few seconds, then resumes. */
export function CelebrationCard() {
  const c = store.ui.celebration;
  if (!c) return null;
  const order = orderById(c.orderId);
  return (
    <div className="card celebration" role="status">
      <Icon k="ui.check" size={40} />
      <div>
        <div className="ctitle">{fmt(S.celebration.complete, { customer: order?.customer ?? '' })}</div>
        <div className="cline">
          <Icon k="ui.coin" size={18} /> {fmt(S.celebration.earned, { coins: c.reward })}
        </div>
        {c.unlockLine && <div className="cline unlock">{c.unlockLine}</div>}
      </div>
    </div>
  );
}
