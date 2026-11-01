import { paletteKey } from '../assets/manifest';
import { audio } from '../app/audio';
import { store } from '../app/store';
import { PLOTS } from '../sim/data/plots';
import { PALETTE_ORDER, STRUCTURES } from '../sim/data/structures';
import type { ItemKind } from '../sim/types';
import { Icon } from './Icon';
import { building, COPY, EXTRA, fmt, itemName } from './strings';

export function Palette() {
  const ui = store.ui;
  const world = store.sim.world;
  const unlocked = PALETTE_ORDER.filter((k) => store.sim.isUnlocked(k));
  const basket = Object.entries(world.basket).filter(([, n]) => (n ?? 0) > 0) as Array<[ItemKind, number]>;
  const expansion = PLOTS[1];
  const canExpand = world.expansionUnlocked && !world.unlockedPlotIds.includes(expansion.id);
  const hover = () => audio.hover();
  const basketCount = basket.reduce((a, [, n]) => a + n, 0);

  if (!ui.paletteOpen) {
    return (
      <div className="card palette collapsed">
        <button className="btn" onClick={() => store.setUi({ paletteOpen: true })} onPointerEnter={hover} aria-expanded={false} aria-label={COPY.hud.buildShow}>
          ▲ {COPY.hud.build}
        </button>
      </div>
    );
  }
  return (
    <nav className="card palette" aria-label={COPY.a11y.buildPalette}>
      <div className="tools">
        {unlocked.map((kind) => {
          const def = STRUCTURES[kind];
          const c = building(kind);
          const active = ui.tool.type === 'build' && ui.tool.kind === kind;
          const poor = world.coins < def.cost;
          return (
            <button
              key={kind}
              className={'ptool' + (active ? ' active' : '') + (poor ? ' unaffordable' : '')}
              onClick={() => store.setTool(active ? { type: 'select' } : { type: 'build', kind })}
              onPointerEnter={hover}
              title={`${c.name}: ${c.tooltip} ${fmt(COPY.palette.cost, { cost: def.cost })}. ${kind === 'belt' ? COPY.palette.hint.belt : COPY.palette.hint.place}`}
              aria-label={`${c.name}, ${fmt(COPY.palette.cost, { cost: def.cost })}`}
              aria-pressed={active}
              data-testid={`build-${kind}`}
            >
              <Icon k={paletteKey(kind)} size={40} />
              <span className="pname">{c.name}</span>
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
          title={`${COPY.palette.tools.remove.tooltip} ${COPY.palette.hint.remove}`}
          aria-label={COPY.a11y.remove}
          aria-pressed={ui.tool.type === 'remove'}
          data-testid="tool-remove"
        >
          <Icon k="ui.remove" size={40} />
          <span className="pname">{COPY.palette.tools.remove.name}</span>
          <span className="pcost" style={{ color: 'var(--moss-deep)' }}>
            {EXTRA.palette.refund}
          </span>
        </button>
        {canExpand && (
          <button
            className={'ptool' + (world.coins < expansion.cost ? ' unaffordable' : '')}
            onClick={() => store.dispatch({ type: 'expand' })}
            onPointerEnter={hover}
            title={`${COPY.expansion.tooltip} ${fmt(COPY.expansion.confirmCost, { cost: expansion.cost })} ${EXTRA.palette.expandLine}`}
            aria-label={`${COPY.expansion.button}, ${fmt(COPY.palette.cost, { cost: expansion.cost })}`}
            data-testid="tool-expand"
          >
            <Icon k="ui.expand" size={40} />
            <span className="pname">{COPY.expansion.button}</span>
            <span className="pcost">
              <Icon k="ui.coin" size={14} /> {expansion.cost}
            </span>
          </button>
        )}
        {basket.length > 0 && (
          <div className="basket" title={COPY.basket.hint} data-testid="basket" aria-label={fmt(COPY.a11y.basket, { count: basketCount })}>
            <span className="pname" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon k="ui.basket" size={18} /> {COPY.basket.title}
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
                    aria-label={fmt(COPY.a11y.basketItem, { item: itemName(kind) }) + ` (${n})`}
                    title={`${itemName(kind)} ×${n}. ${COPY.basket.hint}`}
                  >
                    <Icon k={`item.${kind}`} size={22} /> {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <button className="btn quiet collapse" onClick={() => store.setUi({ paletteOpen: false })} onPointerEnter={hover} aria-label={COPY.hud.buildHide} title={COPY.hud.buildHide}>
        ▼
      </button>
    </nav>
  );
}
