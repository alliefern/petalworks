import { store } from '../app/store';
import { Icon } from './Icon';
import { COPY, fmt, orderCopy } from './strings';

/** A short non-modal beat after an order packs. The sim holds for a few seconds, then resumes. */
export function CelebrationCard() {
  const c = store.ui.celebration;
  if (!c) return null;
  const oc = orderCopy(c.orderId);
  return (
    <div className="card celebration" role="status">
      <Icon k="ui.check" size={40} />
      <div>
        <div className="ctitle">{oc?.complete}</div>
        <div className="cline">
          <Icon k="ui.coin" size={18} /> {fmt(COPY.celebration.earned, { coins: c.reward })}
        </div>
        {c.unlockLine && <div className="cline unlock">{c.unlockLine}</div>}
      </div>
    </div>
  );
}
