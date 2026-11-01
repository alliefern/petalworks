import { paletteKey } from '../assets/manifest';
import { store } from '../app/store';
import { BELT_TICKS, INPUT_BUFFER_MULTIPLIER, STOCK_CAP } from '../sim/data/balance';
import { ITEMS } from '../sim/data/items';
import { RECIPES } from '../sim/data/recipes';
import { STRUCTURES } from '../sim/data/structures';
import { DIR_NAMES } from '../sim/grid';
import type { BlockReason, ItemKind, Structure } from '../sim/types';
import { Icon } from './Icon';

const BLOCK_TEXT: Record<BlockReason, string> = {
  none: '',
  queue: 'Waiting for the belt ahead to clear.',
  dead_end: 'The belt ends here. Extend it or point it at a machine.',
  head_on: 'The belt ahead points back at this one.',
  wrong_item: 'The machine ahead has no recipe for this item.',
  buffer_full: 'The machine ahead is full of this ingredient.',
  stock_full: 'The Packing Station has plenty of these already.',
};

function State({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={'state ' + kind}>{children}</span>;
}

export function Inspector() {
  const ui = store.ui;
  const world = store.sim.world;
  const s: Structure | undefined = ui.selectedId !== null ? world.structures[ui.selectedId] : undefined;
  if (!s) return null;
  const def = STRUCTURES[s.kind];

  let body: React.ReactNode = null;
  if (def.role === 'belt') {
    const b = s.belt!;
    body = (
      <>
        <div className="row">
          {b.item ? (
            <>
              <State kind={b.block === 'none' || b.block === 'queue' ? 'working' : 'blocked'}>{b.block === 'none' || b.block === 'queue' ? 'Carrying' : 'Stuck'}</State>
              <span className="chip">
                <Icon k={`item.${b.item.kind}`} /> {ITEMS[b.item.kind].name}
              </span>
            </>
          ) : (
            <State kind="idle">Empty</State>
          )}
        </div>
        {b.item && b.block !== 'none' && <div className="why">{BLOCK_TEXT[b.block]}</div>}
        <div className="row">Moves one tile every {BELT_TICKS / 10} s, toward the {DIR_NAMES[s.facing]}.</div>
      </>
    );
  } else if (def.role === 'producer') {
    const p = s.producer!;
    const pct = p.output ? 100 : Math.round((100 * p.growTicks) / def.growTicks!);
    body = (
      <>
        <div className="row">
          {p.blocked ? <State kind="blocked">Blocked</State> : p.output ? <State kind="ready">Ready</State> : <State kind="growing">Growing</State>}
          <span className="chip">
            <Icon k={`item.${def.produces}`} /> {ITEMS[def.produces!].name} every {def.growTicks! / 10} s
          </span>
        </div>
        <div className="bar" aria-label={`Growth ${pct}%`}>
          <span style={{ width: pct + '%' }} />
        </div>
        {p.blocked && <div className="why">The flower can’t leave: put a belt or machine on the {DIR_NAMES[s.facing]} side, pointing away.</div>}
        <div className="row">Output leaves toward the {DIR_NAMES[s.facing]}.</div>
      </>
    );
  } else if (def.role === 'processor') {
    const m = s.processor!;
    const recipe = RECIPES[def.recipe!];
    const pct = m.workTicks === null ? 0 : Math.round((100 * m.workTicks) / recipe.ticks);
    const state = m.blocked ? <State kind="blocked">Output blocked</State> : m.workTicks !== null ? <State kind="working">Working</State> : m.outputs.length ? <State kind="ready">Ready</State> : <State kind="waiting">Waiting for ingredients</State>;
    body = (
      <>
        <div className="row">{state}</div>
        <div className="label">Recipe · {recipe.ticks / 10} s</div>
        <div className="row">
          {Object.entries(recipe.inputs).map(([k, n]) => (
            <span className="chip" key={k}>
              <Icon k={`item.${k}`} /> {n}× {ITEMS[k as ItemKind].name}
            </span>
          ))}
          <span>→</span>
          <span className="chip">
            <Icon k={`item.${recipe.output}`} /> {ITEMS[recipe.output].name}
          </span>
        </div>
        <div className="bar" aria-label={`Progress ${pct}%`}>
          <span style={{ width: pct + '%' }} />
        </div>
        <div className="label">Ingredients held</div>
        <div className="row">
          {Object.entries(recipe.inputs).map(([k, n]) => {
            const have = m.inputs.filter((i) => i.kind === k).length;
            return (
              <span className="chip" key={k}>
                <Icon k={`item.${k}`} /> {have}/{(n ?? 0) * INPUT_BUFFER_MULTIPLIER}
              </span>
            );
          })}
          <span className="chip">
            <Icon k={`item.${recipe.output}`} /> {m.outputs.length} ready
          </span>
        </div>
        {m.blocked && <div className="why">Finished goods can’t leave: the {DIR_NAMES[s.facing]} side needs a belt pointing away, or a Packing Station.</div>}
        {m.lastRefusedKind && world.tick - m.lastRefusedTick < 40 && <div className="why">Refused a {ITEMS[m.lastRefusedKind].name}: not in this recipe or buffer full.</div>}
        <div className="row">Takes ingredients from any side; output leaves toward the {DIR_NAMES[s.facing]}.</div>
      </>
    );
  } else {
    const stock = Object.entries(world.stock).filter(([, n]) => (n ?? 0) > 0) as Array<[ItemKind, number]>;
    body = (
      <>
        <div className="row">
          <State kind="idle">Received {s.packing!.received}</State>
        </div>
        <div className="row">Accepts goods from every side and fills the current order. {store.sandbox ? 'In the open market, goods sell on arrival.' : `Holds up to ${STOCK_CAP} spare of each kind.`}</div>
        {stock.length > 0 && (
          <>
            <div className="label">Spare stock (shared by all stations)</div>
            <div className="row">
              {stock.map(([k, n]) => (
                <span className="chip" key={k}>
                  <Icon k={`item.${k}`} /> {n}
                </span>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <aside className="card inspector" aria-label={`${def.name} details`} data-testid="inspector">
      <h3>
        <Icon k={paletteKey(s.kind)} size={34} /> {def.name}
      </h3>
      <div className="blurb">{def.blurb}</div>
      {body}
      <div className="actions">
        {def.hasFacing && (
          <button className="btn" onClick={() => store.dispatch({ type: 'rotate', id: s.id })} title="Rotate (R)">
            <Icon k="ui.rotate" size={18} /> Rotate
          </button>
        )}
        <button className="btn danger" onClick={() => store.dispatch({ type: 'remove', id: s.id })} title="Remove for a full refund (Delete)">
          <Icon k="ui.remove" size={18} /> Remove
        </button>
        <button className="btn quiet" onClick={() => store.select(null)} aria-label="Close inspector">
          Close
        </button>
      </div>
    </aside>
  );
}
