import { useEffect, useRef } from 'react';
import { store } from '../app/store';
import { STRUCTURES } from '../sim/data/structures';
import { ITEMS } from '../sim/data/items';
import { fmt, S } from './strings';

/** Floating label near the pointer while a tool is active. Position updates outside React. */
export function BuildHint() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 18}px)`;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);
  const ui = store.ui;
  if (ui.tool.type === 'select' || !ui.hover) return null;
  let text = '';
  let sub = '';
  let bad = false;
  if (ui.tool.type === 'build') {
    const def = STRUCTURES[ui.tool.kind];
    if (ui.dragPath) {
      const n = ui.dragPath.length;
      text = n === 1 ? fmt(S.palette.beltCount, { cost: def.cost }) : fmt(S.palette.beltsCount, { n, cost: n * def.cost });
      sub = S.palette.releaseToLay;
    } else {
      const check = store.sim.canPlace(ui.tool.kind, ui.hover.x, ui.hover.y);
      text = `${def.name} · ${fmt(S.palette.cost, { cost: def.cost })}`;
      sub = check.ok ? (def.hasFacing ? `${fmt(S.palette.facing, { facing: S.facing[ui.buildFacing] })} · ${S.palette.rotateHint}` : S.palette.clickToPlace) : (check.message ?? '');
      bad = !check.ok;
    }
  } else if (ui.tool.type === 'remove') {
    const t = store.sim.at(ui.hover.x, ui.hover.y);
    if (t && STRUCTURES[t.kind].removable) {
      text = fmt(S.palette.removeWhat, { name: STRUCTURES[t.kind].name });
      sub = fmt(S.palette.refundLine, { coins: STRUCTURES[t.kind].refund });
    } else {
      text = t ? `The ${STRUCTURES[t.kind].name} stays in the yard.` : S.palette.nothingHere;
      bad = true;
    }
  } else {
    text = fmt(S.palette.placeItem, { item: ITEMS[ui.tool.kind].name });
    const t = store.sim.at(ui.hover.x, ui.hover.y);
    bad = !t || t.kind !== 'belt' || !!t.belt?.item;
    sub = bad ? S.palette.needsBelt : S.palette.dropHere;
  }
  return (
    <div ref={ref} className={'buildhint' + (bad ? ' bad' : '')} style={{ left: 0, top: 0 }} aria-hidden>
      {text}
      {sub && (
        <>
          <br />
          <small>{sub}</small>
        </>
      )}
    </div>
  );
}
