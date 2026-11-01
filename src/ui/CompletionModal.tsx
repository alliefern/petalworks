import { useCallback } from 'react';
import { store } from '../app/store';
import { Icon } from './Icon';
import { S } from './strings';
import { useFocusTrap } from './useFocusTrap';

export function CompletionModal() {
  const w = store.sim.world;
  const close = useCallback(() => {
    store.setUi({ completionOpen: false });
    store.save();
  }, []);
  const ref = useFocusTrap<HTMLDivElement>(close);
  return (
    <div className="overlay">
      <div className="card modal" role="dialog" aria-modal="true" aria-label={S.ending.title} ref={ref} data-testid="completion">
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
          <Icon k="item.daisy" size={48} />
          <Icon k="item.mixed_bouquet" size={56} />
          <Icon k="item.lavender" size={48} />
        </div>
        <h2 style={{ textAlign: 'center' }}>{S.ending.title}</h2>
        <p style={{ textAlign: 'center' }}>{S.ending.body}</p>
        <div className="stats">
          <div className="stat">
            <b>{w.orders.completedIds.length}</b>
            <span>{S.ending.ordersFilled}</span>
          </div>
          <div className="stat">
            <b>{w.stats.delivered}</b>
            <span>{S.ending.itemsDelivered}</span>
          </div>
          <div className="stat">
            <b>{w.stats.coinsEarned}</b>
            <span>{S.ending.coinsEarned}</span>
          </div>
        </div>
        <p>{S.ending.market}</p>
        <div className="actions">
          <button className="btn primary" onClick={close} data-autofocus data-testid="completion-close">
            {S.ending.button}
          </button>
        </div>
      </div>
    </div>
  );
}
