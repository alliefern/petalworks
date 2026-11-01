import { paletteKey } from '../assets/manifest';
import { audio } from '../app/audio';
import { store } from '../app/store';
import { BELT_TICKS, INPUT_BUFFER_PER_INGREDIENT, STOCK_CAP, TICK_HZ } from '../sim/data/balance';
import { RECIPES } from '../sim/data/recipes';
import { STRUCTURES } from '../sim/data/structures';
import type { ItemKind, Structure } from '../sim/types';
import { Icon } from './Icon';
import { blockCopy, building, buildingName, COPY, EXTRA, facingWord, fmt, itemName, recipeCopy } from './strings';

function State({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={'state ' + kind}>{children}</span>;
}

const secs = (ticks: number) => (ticks / TICK_HZ).toFixed(ticks % TICK_HZ === 0 ? 0 : 1);
const st = COPY.states;
const L = COPY.inspector.labels;
const V = COPY.inspector.values;

export function Inspector() {
  const ui = store.ui;
  const world = store.sim.world;
  const s: Structure | undefined = ui.selectedId !== null ? world.structures[ui.selectedId] : undefined;
  if (!s) return null;
  const def = STRUCTURES[s.kind];
  const c = building(s.kind);
  const facing = facingWord(s.facing);

  let body: React.ReactNode = null;
  if (def.role === 'belt') {
    const b = s.belt!;
    const stuck = !!b.item && b.block !== 'none' && b.block !== 'queue';
    const bc = b.item && b.block !== 'none' ? blockCopy(b.block, { item: b.item.kind, target: 'The machine ahead', onBelt: true }) : null;
    body = (
      <>
        <div className="row">
          {b.item ? (
            <>
              <State kind={stuck ? 'blocked' : 'working'}>{stuck && bc ? bc.label : fmt(st.belt.carrying.label, { item: itemName(b.item.kind) })}</State>
              <span className="chip">
                <Icon k={`item.${b.item.kind}`} /> {itemName(b.item.kind)}
              </span>
            </>
          ) : (
            <State kind="idle">{st.belt.empty.label}</State>
          )}
        </div>
        {bc && <div className={stuck ? 'why' : 'muted'}>{bc.detail}</div>}
        <div className="row">
          {fmt(EXTRA.states.movesEvery, { seconds: BELT_TICKS / TICK_HZ })} {b.item ? fmt(st.belt.carrying.detail, { facing }) : fmt(st.belt.empty.detail, { facing })}
        </div>
      </>
    );
  } else if (def.role === 'producer') {
    const p = s.producer!;
    const pct = p.output ? 100 : Math.round((100 * p.growTicks) / def.growTicks!);
    const blocked = p.blockedTicks > 3;
    const bc = blocked ? blockCopy(p.block, { item: p.output?.kind, target: 'The machine ahead' }) : null;
    body = (
      <>
        <div className="row">
          {bc ? <State kind="blocked">{bc.label}</State> : p.output ? <State kind="ready">{st.ready.label}</State> : <State kind="growing">{st.growing.label}</State>}
          <span className="chip">
            <Icon k={`item.${def.produces}`} /> {fmt(EXTRA.states.growsEvery, { item: itemName(def.produces!), seconds: secs(def.growTicks!) })}
          </span>
        </div>
        <div className="bar" aria-hidden>
          <span style={{ width: pct + '%' }} />
        </div>
        <div className="muted">
          {L.progress}: {p.output ? fmt(st.ready.detail, { item: itemName(p.output.kind) }) : fmt(V.progress, { elapsed: secs(p.growTicks), total: secs(def.growTicks!) })}
        </div>
        {bc && <div className="why">{bc.detail}</div>}
        <div className="row">
          {L.sends}: {fmt(V.sends, { facing })}. {c.inspector}
        </div>
      </>
    );
  } else if (def.role === 'processor') {
    const m = s.processor!;
    const recipe = RECIPES[m.recipeId];
    const rc = recipeCopy(m.recipeId);
    const pct = m.workTicks === null ? 0 : Math.round((100 * m.workTicks) / recipe.durationTicks);
    const blocked = m.blockedTicks > 3;
    const bc = blocked ? blockCopy(m.block, { item: m.outputs[0]?.kind, target: 'The machine ahead' }) : null;
    const missing = Object.entries(recipe.inputs).filter(([k, n]) => m.inputs.filter((i) => i.kind === k).length < (n ?? 0));
    let state: React.ReactNode;
    let detail = '';
    if (bc) {
      state = <State kind="blocked">{bc.label}</State>;
      detail = bc.detail;
    } else if (m.workTicks !== null) {
      state = <State kind="working">{st.processing.label}</State>;
      detail = fmt(st.processing.detail, { item: itemName(recipe.output) });
    } else if (m.outputs.length) {
      state = <State kind="ready">{st.ready.label}</State>;
      detail = fmt(st.ready.detail, { item: itemName(recipe.output) });
    } else if (m.inputs.length && missing.length === 1) {
      const [k, n] = missing[0];
      const have = m.inputs.filter((i) => i.kind === k).length;
      state = <State kind="waiting">{fmt(st.waitingFor.label, { count: (n ?? 0) - have, item: itemName(k as ItemKind, (n ?? 0) - have) })}</State>;
      detail = fmt(st.waitingFor.detail, { have, need: n ?? 0 });
    } else {
      state = <State kind="waiting">{st.waiting.label}</State>;
      detail = fmt(st.waiting.detail, { takes: rc?.in ?? '' });
    }
    body = (
      <>
        <div className="row">{state}</div>
        <div className="muted">{detail}</div>
        <div className="label">{L.recipe}</div>
        <div className="row">
          {Object.entries(recipe.inputs).map(([k, n]) => (
            <span className="chip" key={k}>
              <Icon k={`item.${k}`} /> {n}× {itemName(k as ItemKind, n ?? 1)}
            </span>
          ))}
          <span aria-hidden>→</span>
          <span className="chip">
            <Icon k={`item.${recipe.output}`} /> {itemName(recipe.output)}
          </span>
          <span className="muted">{fmt(rc?.time ?? '{seconds} seconds', { seconds: secs(recipe.durationTicks) })}</span>
        </div>
        <div className="bar" aria-hidden>
          <span style={{ width: pct + '%' }} />
        </div>
        <div className="muted">
          {L.progress}: {m.workTicks === null ? '—' : fmt(V.progress, { elapsed: secs(m.workTicks), total: secs(recipe.durationTicks) })}
        </div>
        <div className="label">{L.holds}</div>
        <div className="row">
          {Object.entries(recipe.inputs).map(([k]) => {
            const have = m.inputs.filter((i) => i.kind === k).length;
            return (
              <span className="chip" key={k}>
                <Icon k={`item.${k}`} /> {fmt(V.input, { have, need: INPUT_BUFFER_PER_INGREDIENT, item: itemName(k as ItemKind, 2) })}
              </span>
            );
          })}
          <span className="chip">
            <Icon k={`item.${recipe.output}`} /> {fmt(EXTRA.states.readyCount, { n: m.outputs.length })}
          </span>
        </div>
        {m.lastRefusedKind && world.tick - m.lastRefusedTick < 40 && <div className="why">{fmt(EXTRA.states.refused, { item: itemName(m.lastRefusedKind) })}</div>}
        <div className="row">
          {L.sends}: {fmt(V.sends, { facing })}. {c.inspector}
        </div>
      </>
    );
  } else {
    const stock = Object.entries(world.stock).filter(([, n]) => (n ?? 0) > 0) as Array<[ItemKind, number]>;
    const receiving = s.packing!.lastReceivedTick >= 0 && world.tick - s.packing!.lastReceivedTick < 8;
    body = (
      <>
        <div className="row">
          <State kind={receiving ? 'ready' : 'idle'}>{receiving ? st.packing.receiving.label : st.packing.waiting.label}</State>
          <span className="chip">{fmt(EXTRA.states.received, { count: s.packing!.received })}</span>
        </div>
        <div className="muted">{receiving ? st.packing.receiving.detail : st.packing.waiting.detail}</div>
        <div className="row">
          {c.inspector} {store.sandbox ? EXTRA.states.packingSandbox : fmt(EXTRA.states.packingCap, { cap: STOCK_CAP })}
        </div>
        <div className="label">{L.stored}</div>
        <div className="row">
          {stock.length === 0 && <span className="muted">{V.storedEmpty}</span>}
          {stock.map(([k, n]) => (
            <span className="chip" key={k} title={fmt(st.packing.storedUnused.detail, { item: itemName(k, 2) })}>
              <Icon k={`item.${k}`} /> {fmt(V.stored, { count: n, item: itemName(k, n) })}
            </span>
          ))}
        </div>
      </>
    );
  }

  return (
    <aside className="card inspector" aria-label={COPY.a11y.inspector} data-testid="inspector">
      <h3>
        <Icon k={paletteKey(s.kind)} size={34} /> {buildingName(s.kind)}
      </h3>
      <div className="blurb">{c.tooltip}</div>
      {body}
      <div className="actions">
        {def.hasFacing && (
          <button className="btn" onClick={() => store.dispatch({ type: 'rotate', id: s.id })} onPointerEnter={() => audio.hover()} title={COPY.hud.rotateTooltip} aria-label={COPY.a11y.rotate} data-testid="inspector-rotate">
            <Icon k="ui.rotate" size={18} /> {COPY.hud.rotate}
          </button>
        )}
        {def.removable && (
          <button className="btn danger" onClick={() => store.dispatch({ type: 'remove', id: s.id })} onPointerEnter={() => audio.hover()} title={EXTRA.inspector.removeTip} data-testid="inspector-remove">
            <Icon k="ui.remove" size={18} /> {COPY.palette.tools.remove.name}
          </button>
        )}
        <button className="btn quiet" onClick={() => store.select(null)} aria-label={COPY.a11y.close}>
          {COPY.settings.close}
        </button>
      </div>
    </aside>
  );
}
