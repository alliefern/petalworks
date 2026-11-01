import { paletteKey } from '../assets/manifest';
import { store } from '../app/store';
import { EXPANSION_COST } from '../sim/data/balance';
import { ITEMS } from '../sim/data/items';
import { PALETTE_ORDER, STRUCTURES } from '../sim/data/structures';
import type { ItemKind } from '../sim/types';
import { Icon } from './Icon';

export function Palette() {
  const ui = store.ui;
  const world = store.sim.world;
  const unlocked = PALETTE_ORDER.filter((k) => store.sim.isUnlocked(k));
  const basket = Object.entries(world.basket).filter(([, n]) => (n ?? 0) > 0) as Array<[ItemKind, number]>;
  const canExpand = world.expansionUnlocked && !world.expanded;

  if (!ui.paletteOpen) {
    return (
      <div className="card palette collapsed">
        <button className="btn" onClick={() => store.setUi({ paletteOpen: true })} aria-expanded={false}>
          ▲ Build
        </button>
      </div>
    );
  }
  return (
    <nav className="card palette" aria-label="Build palette">
      <div className="tools">
        {unlocked.map((kind, i) => {
          const def = STRUCTURES[kind];
          const active = ui.tool.type === 'build' && ui.tool.kind === kind;
          const poor = world.coins < def.cost;
          return (
            <button
              key={kind}
              className={'ptool' + (active ? ' active' : '') + (poor ? ' unaffordable' : '')}
              onClick={() => store.setTool(active ? { type: 'select' } : { type: 'build', kind })}
              title={`${def.name} — ${def.blurb} (${def.cost} coins)`}
              aria-pressed={active}
              data-testid={`build-${kind}`}
            >
              <span className="key" aria-hidden>
                {i + 1}
              </span>
              <Icon k={paletteKey(kind)} size={44} />
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
          title="Remove a structure for a full refund (X). Items inside go to your basket."
          aria-pressed={ui.tool.type === 'remove'}
          data-testid="tool-remove"
        >
          <Icon k="ui.remove" size={44} />
          <span className="pname">Remove</span>
          <span className="pcost" style={{ color: 'var(--moss-deep)' }}>refund</span>
        </button>
        {canExpand && (
          <button
            className={'ptool' + (world.coins < EXPANSION_COST ? ' unaffordable' : '')}
            onClick={() => store.dispatch({ type: 'expand' })}
            title={`Open the extra garden plot (${EXPANSION_COST} coins). The garden grows to 20 × 14 tiles.`}
            data-testid="tool-expand"
          >
            <Icon k="ui.expand" size={44} />
            <span className="pname">Expand garden</span>
            <span className="pcost">
              <Icon k="ui.coin" size={14} /> {EXPANSION_COST}
            </span>
          </button>
        )}
        {basket.length > 0 && (
          <div className="basket" title="Items recovered from removed structures. Pick one, then click an empty belt to put it back.">
            <span className="pname" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon k="ui.basket" size={18} /> Basket
            </span>
            <div className="basket-items">
              {basket.map(([kind, n]) => {
                const active = ui.tool.type === 'basket' && ui.tool.kind === kind;
                return (
                  <button key={kind} className={'bitem' + (active ? ' active' : '')} onClick={() => store.setTool(active ? { type: 'select' } : { type: 'basket', kind })} aria-pressed={active} title={`${ITEMS[kind].name} ×${n}: click, then click an empty belt`}>
                    <Icon k={`item.${kind}`} size={22} /> {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <button className="btn quiet collapse" onClick={() => store.setUi({ paletteOpen: false })} aria-label="Hide build palette" title="Hide">
        ▼
      </button>
    </nav>
  );
}
