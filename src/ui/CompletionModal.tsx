import { useEffect, useRef } from 'react';
import { store } from '../app/store';
import { Icon } from './Icon';

export function CompletionModal() {
  const w = store.sim.world;
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
  }, []);
  return (
    <div className="overlay">
      <div className="card modal" role="dialog" aria-modal="true" aria-label="Workshop complete" data-testid="completion">
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
          <Icon k="item.daisy" size={48} />
          <Icon k="item.mixed_bouquet" size={56} />
          <Icon k="item.lavender" size={48} />
        </div>
        <h2 style={{ textAlign: 'center' }}>The wedding bouquet is on its way!</h2>
        <p style={{ textAlign: 'center' }}>Every order in the village is filled. Your little garden is a real flower workshop now.</p>
        <div className="stats">
          <div className="stat">
            <b>{w.completedOrders.length}</b>
            <span>orders filled</span>
          </div>
          <div className="stat">
            <b>{w.stats.delivered}</b>
            <span>items delivered</span>
          </div>
          <div className="stat">
            <b>{w.stats.coinsEarned}</b>
            <span>coins earned</span>
          </div>
        </div>
        <p>From here on the market is open: anything you deliver sells for coins, every tool is unlocked, and the garden is yours to redesign.</p>
        <div className="actions">
          <button ref={btn} className="btn primary" onClick={() => { store.setUi({ completionOpen: false }); store.save(); }}>
            Keep gardening
          </button>
        </div>
      </div>
    </div>
  );
}
