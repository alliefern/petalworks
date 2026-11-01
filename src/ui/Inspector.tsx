import { paletteKey } from '../assets/manifest';
import { audio } from '../app/audio';
import { blockText, store } from '../app/store';
import { BELT_TICKS, INPUT_BUFFER_PER_INGREDIENT, STOCK_CAP, TICK_HZ } from '../sim/data/balance';
import { ITEMS } from '../sim/data/items';
import { RECIPES } from '../sim/data/recipes';
import { STRUCTURES } from '../sim/data/structures';
import type { ItemKind, Structure } from '../sim/types';
import { Icon } from './Icon';
import { fmt, S } from './strings';

function State({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={'state ' + kind}>{children}</span>;
}

const secs = (ticks: number) => (ticks / TICK_HZ).toFixed(ticks % TICK_HZ === 0 ? 0 : 1);

export function Inspector() {
  const ui = store.ui;
  const world = store.sim.world;
  const s: Structure | undefined = ui.selectedId !== null ? world.structures[ui.selectedId] : undefined;
  if (!s) return null;
  const def = STRUCTURES[s.kind];
  const facing = S.facing[s.facing];

  let body: React.ReactNode = null;
  if (def.role === 'belt') {
    const b = s.belt!;
    const stuck = !!b.item && b.block !== 'none' && b.block !== 'queue';
    body = (
      <>
        <div className="row">
          {b.item ? (
            <>
              <State kind={stuck ? 'blocked' : 'working'}>{stuck ? S.states.blocked : fmt(S.states.carrying, { item: ITEMS[b.item.kind].name })}</State>
              <span className="chip">
                <Icon k={`item.${b.item.kind}`} /> {ITEMS[b.item.kind].name}
              </span>
            </>
          ) : (
            <State kind="idle">{S.states.empty}</State>
          )}
        </div>
        {b.item && b.block !== 'none' && <div className={stuck ? 'why' : 'muted'}>{blockText(b.block, b.item.kind, b.block === 'dead_end' ? 'belt' : 'The machine ahead')}</div>}
        <div className="row">
          {fmt(S.states.movesEvery, { seconds: BELT_TICKS / TICK_HZ })} {fmt(S.states.heading, { facing })}
        </div>
      </>
    );
  } else if (def.role === 'producer') {
    const p = s.producer!;
    const pct = p.output ? 100 : Math.round((100 * p.growTicks) / def.growTicks!);
    const blocked = p.blockedTicks > 3;
    body = (
      <>
        <div className="row">
          {blocked ? <State kind="blocked">{S.states.blocked}</State> : p.output ? <State kind="ready">{S.states.ready}</State> : <State kind="growing">{S.states.growing}</State>}
          <span className="chip">
            <Icon k={`item.${def.produces}`} /> {fmt(S.states.growsEvery, { item: ITEMS[def.produces!].name, seconds: secs(def.growTicks!) })}
          </span>
        </div>
        <div className="bar" aria-hidden>
          <span style={{ width: pct + '%' }} />
        </div>
        <div className="muted">{p.output ? S.states.ready : fmt(S.states.progress, { elapsed: secs(p.growTicks), total: secs(def.growTicks!) })}</div>
        {blocked && <div className="why">{blockText(p.block, p.output?.kind, 'The machine ahead')}</div>}
        <div className="row">{fmt(S.states.outputLeaves, { facing })}</div>
      </>
    );
  } else if (def.role === 'processor') {
    const m = s.processor!;
    const recipe = RECIPES[m.recipeId];
    const pct = m.workTicks === null ? 0 : Math.round((100 * m.workTicks) / recipe.durationTicks);
    const blocked = m.blockedTicks > 3;
    const missing = Object.entries(recipe.inputs).filter(([k, n]) => m.inputs.filter((i) => i.kind === k).length < (n ?? 0));
    let state: React.ReactNode;
    if (blocked) state = <State kind="blocked">{S.states.blocked}</State>;
    else if (m.workTicks !== null) state = <State kind="working">{S.states.processing}</State>;
    else if (m.outputs.length) state = <State kind="ready">{S.states.ready}</State>;
    else if (m.inputs.length && missing.length === 1) {
      const [k, n] = missing[0];
      const have = m.inputs.filter((i) => i.kind === k).length;
      state = <State kind="waiting">{fmt(S.states.waitingFor, { count: (n ?? 0) - have, item: ITEMS[k as ItemKind].name })}</State>;
    } else state = <State kind="waiting">{S.states.waiting}</State>;
    body = (
      <>
        <div className="row">{state}</div>
        <div className="label">{fmt(S.inspector.recipe, { seconds: secs(recipe.durationTicks) })}</div>
        <div className="row">
          {Object.entries(recipe.inputs).map(([k, n]) => (
            <span className="chip" key={k}>
              <Icon k={`item.${k}`} /> {n}× {ITEMS[k as ItemKind].name}
            </span>
          ))}
          <span aria-hidden>→</span>
          <span className="chip">
            <Icon k={`item.${recipe.output}`} /> {ITEMS[recipe.output].name}
          </span>
        </div>
        <div className="bar" aria-hidden>
          <span style={{ width: pct + '%' }} />
        </div>
        <div className="muted">{m.workTicks === null ? '—' : fmt(S.states.progress, { elapsed: secs(m.workTicks), total: secs(recipe.durationTicks) })}</div>
        <div className="label">{S.inspector.holding}</div>
        <div className="row">
          {Object.entries(recipe.inputs).map(([k]) => {
            const have = m.inputs.filter((i) => i.kind === k).length;
            return (
              <span className="chip" key={k}>
                <Icon k={`item.${k}`} /> {have} / {INPUT_BUFFER_PER_INGREDIENT}
              </span>
            );
          })}
          <span className="chip">
            <Icon k={`item.${recipe.output}`} /> {fmt(S.inspector.readyCount, { n: m.outputs.length })}
          </span>
        </div>
        {blocked && <div className="why">{blockText(m.block, m.outputs[0]?.kind, 'The machine ahead')}</div>}
        {m.lastRefusedKind && world.tick - m.lastRefusedTick < 40 && <div className="why">{fmt(S.inspector.refused, { item: ITEMS[m.lastRefusedKind].name })}</div>}
        <div className="row">{fmt(S.states.takesAnySide, { facing })}</div>
      </>
    );
  } else {
    const stock = Object.entries(world.stock).filter(([, n]) => (n ?? 0) > 0) as Array<[ItemKind, number]>;
    const receiving = s.packing!.lastReceivedTick >= 0 && world.tick - s.packing!.lastReceivedTick < 8;
    body = (
      <>
        <div className="row">
          <State kind={receiving ? 'ready' : 'idle'}>{receiving ? S.states.packingReceiving : S.states.packingWaiting}</State>
          <span className="chip">{fmt(S.states.received, { count: s.packing!.received })}</span>
        </div>
        <div className="row">
          {S.states.packingBody} {store.sandbox ? S.states.packingSandbox : fmt(S.states.packingCap, { cap: STOCK_CAP })}
        </div>
        {stock.length > 0 && (
          <>
            <div className="label">{S.states.stored}</div>
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
    <aside className="card inspector" aria-label={S.a11y.inspector} data-testid="inspector">
      <h3>
        <Icon k={paletteKey(s.kind)} size={34} /> {def.name}
      </h3>
      <div className="blurb">{def.blurb}</div>
      {body}
      <div className="actions">
        {def.hasFacing && (
          <button className="btn" onClick={() => store.dispatch({ type: 'rotate', id: s.id })} onPointerEnter={() => audio.hover()} title={S.inspector.rotateTip} data-testid="inspector-rotate">
            <Icon k="ui.rotate" size={18} /> {S.inspector.rotate}
          </button>
        )}
        {def.removable && (
          <button className="btn danger" onClick={() => store.dispatch({ type: 'remove', id: s.id })} onPointerEnter={() => audio.hover()} title={S.inspector.removeTip} data-testid="inspector-remove">
            <Icon k="ui.remove" size={18} /> {S.inspector.remove}
          </button>
        )}
        <button className="btn quiet" onClick={() => store.select(null)} aria-label={S.a11y.close}>
          {S.inspector.close}
        </button>
      </div>
    </aside>
  );
}
