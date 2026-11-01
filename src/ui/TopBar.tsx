import { audio } from '../app/audio';
import { store } from '../app/store';
import { ORDERS } from '../sim/data/orders';
import { Icon } from './Icon';
import { fmt, S } from './strings';

export function TopBar({ onRecenter, onZoom }: { onRecenter: () => void; onZoom: (f: number) => void }) {
  const ui = store.ui;
  const world = store.sim.world;
  const done = world.orders.completedIds.length;
  const hover = () => audio.hover();
  return (
    <div className="topbar" role="toolbar" aria-label="Game controls">
      <div className="card coins" aria-label={fmt(S.a11y.coins, { coins: world.coins })}>
        <Icon k="ui.coin" size={28} />
        <span data-testid="coins" aria-hidden>
          {world.coins}
        </span>
      </div>
      <div className="card group" aria-label={fmt(S.a11y.ordersDone, { done, total: ORDERS.length })}>
        <Icon k="ui.order" size={22} />
        <span style={{ fontWeight: 800 }} aria-hidden>
          {Math.min(done, ORDERS.length)}/{ORDERS.length}
        </span>
      </div>
      {ui.paused && <div className="card group paused-chip">{S.hud.paused}</div>}
      <div className="spacer" />
      <div className="card group" aria-label={S.hud.speed}>
        <button
          className={'btn' + (ui.paused ? ' active' : '')}
          onClick={() => store.togglePause()}
          onPointerEnter={hover}
          aria-label={ui.paused ? S.a11y.resume : S.a11y.pause}
          title={ui.paused ? S.a11y.resume : S.a11y.pause}
          aria-pressed={ui.paused}
          data-testid="pause"
        >
          <Icon k={ui.paused ? 'ui.play' : 'ui.pause'} size={22} />
          <span>{ui.paused ? S.hud.resume : S.hud.pause}</span>
        </button>
        {([1, 2, 3] as const).map((s) => (
          <button
            key={s}
            className={'btn' + (ui.speed === s && !ui.paused ? ' active' : '')}
            onClick={() => store.setSpeed(s)}
            onPointerEnter={hover}
            aria-label={fmt(S.a11y.speed, { n: s })}
            aria-pressed={ui.speed === s && !ui.paused}
            data-testid={`speed-${s}`}
          >
            {s}×
          </button>
        ))}
      </div>
      <div className="card group">
        <button className="btn" onClick={() => store.dispatch({ type: 'undo' })} onPointerEnter={hover} aria-label={S.hud.undoTooltip} title={S.hud.undoTooltip} data-testid="undo">
          <Icon k="ui.undo" size={22} />
          <span>{S.hud.undo}</span>
        </button>
        <button className="btn icon" onClick={() => onZoom(1 / 1.2)} onPointerEnter={hover} aria-label={S.hud.zoomOut} title={S.hud.zoomOut + ' (-)'}>
          −
        </button>
        <button className="btn icon" onClick={() => onZoom(1.2)} onPointerEnter={hover} aria-label={S.hud.zoomIn} title={S.hud.zoomIn + ' (=)'}>
          +
        </button>
        <button className="btn" onClick={onRecenter} onPointerEnter={hover} aria-label={S.hud.fitTooltip} title={S.hud.fitTooltip}>
          {S.hud.fit}
        </button>
        <button
          className={'btn' + (ui.tutorialOpen ? ' active' : '')}
          onClick={() => store.setUi({ tutorialOpen: !ui.tutorialOpen })}
          onPointerEnter={hover}
          aria-label={S.hud.helpTooltip}
          title={S.hud.helpTooltip}
          aria-pressed={ui.tutorialOpen}
          data-testid="help"
        >
          <Icon k="ui.help" size={22} />
          <span>{S.hud.help}</span>
        </button>
        <button className="btn" onClick={() => store.setUi({ settingsOpen: true })} onPointerEnter={hover} aria-label={S.a11y.settings} title={S.hud.settings} data-testid="settings">
          <Icon k="ui.settings" size={22} />
          <span>{S.hud.settings}</span>
        </button>
      </div>
    </div>
  );
}
