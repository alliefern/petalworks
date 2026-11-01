import { useEffect, useRef } from 'react';
import { store } from '../app/store';
import { STRUCTURES } from '../sim/data/structures';
import { buildingName, COPY, EXTRA, facingWord, fmt, itemName } from './strings';

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
      text = n === 1 ? fmt(EXTRA.palette.beltCount, { cost: def.cost }) : fmt(EXTRA.palette.beltsCount, { n, cost: n * def.cost });
      sub = EXTRA.palette.releaseToLay;
    } else {
      const check = store.sim.canPlace(ui.tool.kind, ui.hover.x, ui.hover.y);
      text = `${buildingName(ui.tool.kind)} · ${fmt(COPY.palette.cost, { cost: def.cost })}`;
      if (check.ok) sub = def.hasFacing ? `${fmt(EXTRA.palette.facing, { facing: facingWord(ui.buildFacing) })} · ${EXTRA.palette.rotateHint}` : EXTRA.palette.clickToPlace;
      else {
        const e = COPY.errors;
        sub =
          check.error === 'occupied'
            ? e.occupied
            : check.error === 'locked_plot'
              ? e.lockedPlot
              : check.error === 'unaffordable'
                ? fmt(e.funds, { cost: def.cost, coins: store.sim.world.coins })
                : check.error === 'out_of_bounds'
                  ? e.outside
                  : (check.message ?? '');
        bad = true;
      }
    }
  } else if (ui.tool.type === 'remove') {
    const t = store.sim.at(ui.hover.x, ui.hover.y);
    if (t && STRUCTURES[t.kind].removable) {
      text = fmt(EXTRA.palette.removeWhat, { name: buildingName(t.kind) });
      sub = fmt(EXTRA.palette.refundLine, { coins: STRUCTURES[t.kind].refund });
    } else {
      text = t ? fmt(EXTRA.palette.staysInYard, { name: buildingName(t.kind) }) : COPY.errors.removeEmpty;
      bad = true;
    }
  } else {
    text = fmt(EXTRA.palette.placeItem, { item: itemName(ui.tool.kind) });
    const t = store.sim.at(ui.hover.x, ui.hover.y);
    bad = !t || t.kind !== 'belt' || !!t.belt?.item;
    sub = bad ? EXTRA.palette.needsBelt : EXTRA.palette.dropHere;
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
