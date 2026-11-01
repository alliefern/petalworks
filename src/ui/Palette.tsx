import { paletteKey } from '../assets/manifest';
import { audio } from '../app/audio';
import { store } from '../app/store';
import { ITEMS } from '../sim/data/items';
import { PLOTS } from '../sim/data/plots';
import { PALETTE_ORDER, STRUCTURES } from '../sim/data/structures';
import type { ItemKind } from '../sim/types';
import { Icon } from './Icon';
import { fmt, S } from './strings';

export function Palette() {
  const ui = store.ui;
  const world = store.sim.world;
  const unlocked = PALETTE_ORDER.filter((k) => store.sim.isUnlocked(k));
  const basket = Object.entries(world.basket).filter(([, n]) => (n ?? 0) > 0) as Array<[ItemKind, number]>;
  const expansion = PLOTS[1];
  const canExpand = world.expansionUnlocked && !world.unlockedPlotIds.includes(expansion.id);
  const hover = () => audio.hover();

  if (!ui.paletteOpen) {
    return (
      <div className="card palette collapsed">
        <button className="btn" onClick={() => store.setUi({ paletteOpen: true })} onPointerEnter={hover} aria-expanded={false} aria-label={S.hud.buildShow}>
          ▲ {S.hud.build}
        </button>
      </div>
    );
  }
  return (
    <nav className="card palette" aria-label={S.a11y.buildPalette}>
      <div className="tools">
        {unlocked.map((kind) => {
          const def = STRUCTURES[kind];
          const active = ui.tool.type === 'build' && ui.tool.kind === kind;
          const poor = world.coins < def.cost;
          return (
            <button
              key={kind}
              className={'ptool' + (active ? ' active' : '') + (poor ? ' unaffordable' : '')}
              onClick={() => store.setTool(active ? { type: 'select' } : { type: 'build', kind })}
              onPointerEnter={hover}
              title={`${def.name}: ${def.blurb} ${fmt(S.palette.cost, { cost: def.cost })}. ${kind === 'belt' ? S.palette.hintBelt : S.palette.hintPlace}`}
              aria-label={`${def.name}, ${fmt(S.palette.cost, { cost: def.cost })}`}
              aria-pressed={active}
              data-testid={`build-${kind}`}
            >
              <Icon k={paletteKey(kind)} size={40} />
              <span className="pname">{def.name}</span>
              <span className="pcost">
                <Icon k="ui.coin" size={14} /> {def.cost}
              </span>
            </button>
          );
        })}
        <div className="divider" aria-hidden />
        <button
          className={'ptool' + (ui.tool.type === 'remove' ? ' active' : '')}
          onClick={() => store.setTool(ui.tool.type === 'remove' ? { type: 'select' } : { type: 'remove' })}
          onPointerEnter={hover}
          title={S.palette.removeTooltip}
          aria-label={S.a11y.remove}
          aria-pressed={ui.tool.type === 'remove'}
          data-testid="tool-remove"
        >
          <Icon k="ui.remove" size={40} />
          <span className="pname">{S.palette.remove}</span>
          <span className="pcost" style={{ color: 'var(--moss-deep)' }}>
            {S.palette.refund}
          </span>
        </button>
        {canExpand && (
          <button
            className={'ptool' + (world.coins < expansion.cost ? ' unaffordable' : '')}
            onClick={() => store.dispatch({ type: 'expand' })}
            onPointerEnter={hover}
            title={fmt(S.palette.expandTooltip, { cost: expansion.cost })}
            aria-label={`${S.palette.expand}, ${fmt(S.palette.cost, { cost: expansion.cost })}`}
            data-testid="tool-expand"
          >
            <Icon k="ui.expand" size={40} />
            <span className="pname">{S.palette.expand}</span>
            <span className="pcost">
              <Icon k="ui.coin" size={14} /> {expansion.cost}
            </span>
          </button>
        )}
        {basket.length > 0 && (
          <div className="basket" title={S.palette.basketHint} data-testid="basket">
            <span className="pname" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon k="ui.basket" size={18} /> {S.palette.basket}
            </span>
            <div className="basket-items">
              {basket.map(([kind, n]) => {
                const active = ui.tool.type === 'basket' && ui.tool.kind === kind;
                return (
                  <button
                    key={kind}
                    className={'bitem' + (active ? ' active' : '')}
                    onClick={() => store.setTool(active ? { type: 'select' } : { type: 'basket', kind })}
                    onPointerEnter={hover}
                    aria-pressed={active}
                    aria-label={fmt(S.a11y.basketItem, { item: ITEMS[kind].name }) + ` (${n})`}
                    title={`${ITEMS[kind].name} ×${n}. ${S.basket.hint}`}
                  >
                    <Icon k={`item.${kind}`} size={22} /> {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <button className="btn quiet collapse" onClick={() => store.setUi({ paletteOpen: false })} onPointerEnter={hover} aria-label={S.hud.buildHide} title={S.hud.buildHide}>
        ▼
      </button>
    </nav>
  );
}
