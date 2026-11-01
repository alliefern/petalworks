import { store } from '../app/store';
import { ORDERS } from '../sim/data/orders';
import { Icon } from './Icon';

export function TopBar({ onRecenter, onZoom }: { onRecenter: () => void; onZoom: (f: number) => void }) {
  const ui = store.ui;
  const world = store.sim.world;
  const done = world.completedOrders.length;
  return (
    <div className="topbar" role="toolbar" aria-label="Game controls">
      <div className="card coins" aria-live="polite" aria-label={`${world.coins} coins`}>
        <Icon k="ui.coin" size={28} />
        <span data-testid="coins">{world.coins}</span>
      </div>
      <div className="card group" aria-label="Orders completed">
        <Icon k="ui.order" size={22} />
        <span style={{ fontWeight: 800 }}>
          {Math.min(done, ORDERS.length)}/{ORDERS.length}
        </span>
      </div>
      <div className="spacer" />
      <div className="card group" aria-label="Speed">
        <button className={'btn icon' + (ui.paused ? ' active' : '')} onClick={() => store.togglePause()} aria-label={ui.paused ? 'Resume (Space)' : 'Pause (Space)'} title={ui.paused ? 'Resume (Space)' : 'Pause (Space)'} aria-pressed={ui.paused}>
          <Icon k={ui.paused ? 'ui.play' : 'ui.pause'} size={22} />
        </button>
        {([1, 2, 3] as const).map((s) => (
          <button key={s} className={'btn' + (ui.speed === s && !ui.paused ? ' active' : '')} onClick={() => store.setSpeed(s)} aria-label={`Speed ${s}x`} aria-pressed={ui.speed === s && !ui.paused} style={{ padding: '6px 10px' }}>
            {s}×
          </button>
        ))}
      </div>
      <div className="card group">
        <button className="btn icon" onClick={() => store.dispatch({ type: 'undo' })} aria-label="Undo (Z)" title="Undo last build (Z)">
          <Icon k="ui.undo" size={22} />
        </button>
        <button className="btn icon" onClick={() => onZoom(1 / 1.2)} aria-label="Zoom out" title="Zoom out (mouse wheel)" style={{ fontWeight: 800, fontSize: 18 }}>
          −
        </button>
        <button className="btn icon" onClick={() => onZoom(1.2)} aria-label="Zoom in" title="Zoom in (mouse wheel)" style={{ fontWeight: 800, fontSize: 18 }}>
          +
        </button>
        <button className="btn" onClick={onRecenter} aria-label="Fit garden to screen (F)" title="Fit garden (F)" style={{ padding: '6px 10px' }}>
          Fit
        </button>
        <button className={'btn icon' + (ui.tutorialOpen ? ' active' : '')} onClick={() => store.setUi({ tutorialOpen: !ui.tutorialOpen })} aria-label="Help (H)" title="Show help (H)" aria-pressed={ui.tutorialOpen}>
          <Icon k="ui.help" size={22} />
        </button>
        <button className="btn icon" onClick={() => store.setUi({ settingsOpen: true })} aria-label="Settings" title="Settings">
          <Icon k="ui.settings" size={22} />
        </button>
      </div>
    </div>
  );
}
