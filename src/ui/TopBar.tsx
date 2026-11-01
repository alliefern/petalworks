import { audio } from '../app/audio';
import { store } from '../app/store';
import { ORDERS } from '../sim/data/orders';
import { Icon } from './Icon';
import { COPY, EXTRA, fmt } from './strings';

export function TopBar({ onRecenter, onZoom }: { onRecenter: () => void; onZoom: (f: number) => void }) {
  const ui = store.ui;
  const world = store.sim.world;
  const done = world.orders.completedIds.length;
  const hover = () => audio.hover();
  return (
    <div className="topbar" role="toolbar" aria-label="Game controls">
      <div className="card coins" aria-label={fmt(COPY.a11y.coins, { coins: world.coins })}>
        <Icon k="ui.coin" size={28} />
        <span data-testid="coins" aria-hidden>
          {world.coins}
        </span>
      </div>
      <div className="card group" aria-label={fmt(EXTRA.hud.ordersDone, { done, total: ORDERS.length })}>
        <Icon k="ui.order" size={22} />
        <span style={{ fontWeight: 800 }} aria-hidden>
          {Math.min(done, ORDERS.length)}/{ORDERS.length}
        </span>
      </div>
      {ui.paused && (
        <div className="card group paused-chip" title={COPY.hud.pausedDetail}>
          {COPY.hud.paused}
        </div>
      )}
      <div className="spacer" />
      <div className="card group" aria-label={EXTRA.hud.speed}>
        <button
          className={'btn' + (ui.paused ? ' active' : '')}
          onClick={() => store.togglePause()}
          onPointerEnter={hover}
          aria-label={ui.paused ? COPY.a11y.resume : COPY.a11y.pause}
          title={ui.paused ? COPY.a11y.resume : COPY.a11y.pause}
          aria-pressed={ui.paused}
          data-testid="pause"
        >
          <Icon k={ui.paused ? 'ui.play' : 'ui.pause'} size={22} />
          <span>{ui.paused ? COPY.hud.resume : COPY.hud.pause}</span>
        </button>
        {([1, 2, 3] as const).map((s) => (
          <button
            key={s}
            className={'btn' + (ui.speed === s && !ui.paused ? ' active' : '')}
            onClick={() => store.setSpeed(s)}
            onPointerEnter={hover}
            aria-label={fmt(EXTRA.a11y.speedN, { n: s })}
            title={s === 1 ? COPY.hud.normalTooltip : COPY.hud.fastTooltip}
            aria-pressed={ui.speed === s && !ui.paused}
            data-testid={`speed-${s}`}
          >
            {fmt(EXTRA.hud.speedN, { n: s })}
          </button>
        ))}
      </div>
      <div className="card group">
        <button className="btn" onClick={() => store.dispatch({ type: 'undo' })} onPointerEnter={hover} aria-label={COPY.a11y.undo} title={COPY.hud.undoTooltip} data-testid="undo">
          <Icon k="ui.undo" size={22} />
          <span>{COPY.hud.undo}</span>
        </button>
        <button className="btn icon" onClick={() => onZoom(1 / 1.2)} onPointerEnter={hover} aria-label={EXTRA.hud.zoomOut} title={EXTRA.hud.zoomOut + ' (-)'}>
          −
        </button>
        <button className="btn icon" onClick={() => onZoom(1.2)} onPointerEnter={hover} aria-label={EXTRA.hud.zoomIn} title={EXTRA.hud.zoomIn + ' (=)'}>
          +
        </button>
        <button className="btn" onClick={onRecenter} onPointerEnter={hover} aria-label={EXTRA.hud.fitTooltip} title={EXTRA.hud.fitTooltip}>
          {EXTRA.hud.fit}
        </button>
        <button
          className={'btn' + (ui.tutorialOpen ? ' active' : '')}
          onClick={() => store.setUi({ tutorialOpen: !ui.tutorialOpen })}
          onPointerEnter={hover}
          aria-label={COPY.a11y.help}
          title={COPY.hud.help + ' (H)'}
          aria-pressed={ui.tutorialOpen}
          data-testid="help"
        >
          <Icon k="ui.help" size={22} />
          <span>{EXTRA.hud.tips}</span>
        </button>
        <button className="btn" onClick={() => store.setUi({ settingsOpen: true })} onPointerEnter={hover} aria-label={COPY.a11y.settings} title={COPY.hud.settings} data-testid="settings">
          <Icon k="ui.settings" size={22} />
          <span>{COPY.hud.settings}</span>
        </button>
      </div>
    </div>
  );
}
