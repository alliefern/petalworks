import { useEffect, useRef } from 'react';
import { store } from '../app/store';
import { STRUCTURES } from '../sim/data/structures';
import { ITEMS } from '../sim/data/items';
import { DIR_NAMES } from '../sim/grid';

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
    const check = ui.dragPath ? { ok: true } : store.sim.canPlace(ui.tool.kind, ui.hover.x, ui.hover.y);
    if (ui.dragPath) {
      const n = ui.dragPath.length;
      text = `${n} belt${n === 1 ? '' : 's'} · ${n * def.cost} coins`;
      sub = 'release to lay, R to rotate';
    } else {
      text = `${def.name} · ${def.cost} coins`;
      sub = check.ok ? (def.hasFacing ? `facing ${DIR_NAMES[ui.buildFacing]} · R to rotate` : 'click to place') : (check.message ?? '');
      bad = !check.ok;
    }
  } else if (ui.tool.type === 'remove') {
    const t = store.sim.at(ui.hover.x, ui.hover.y);
    if (t) {
      text = `Remove ${STRUCTURES[t.kind].name}`;
      sub = `refund ${STRUCTURES[t.kind].cost} coins`;
    } else {
      text = 'Nothing here to remove';
      bad = true;
    }
  } else {
    text = `Place ${ITEMS[ui.tool.kind].name}`;
    const t = store.sim.at(ui.hover.x, ui.hover.y);
    bad = !t || t.kind !== 'belt' || !!t.belt?.item;
    sub = bad ? 'needs an empty belt' : 'click to drop it on this belt';
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
