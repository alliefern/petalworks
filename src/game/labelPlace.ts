/** Screen-space rectangle. `right` and `bottom` are the far edges. */
export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function intersects(a: ScreenBox, b: ScreenBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function labelBox(cx: number, cy: number, w: number, h: number): ScreenBox {
  return { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2 };
}

/**
 * Center a label on `anchor`, fully inside the screen and clear of the HUD cards.
 * The label moves the shortest way that clears each card, so a card at the top
 * does not drag the text across the whole garden.
 * Returns null when the anchor is off screen, or when the label cannot fit.
 */
export function placeLabelInView(
  anchor: { x: number; y: number },
  size: { w: number; h: number },
  screen: { w: number; h: number },
  cards: ScreenBox[],
  gap = 8,
): { x: number; y: number } | null {
  if (anchor.x < 0 || anchor.y < 0 || anchor.x > screen.w || anchor.y > screen.h) return null;
  const { w, h } = size;
  if (!(w + gap * 2 <= screen.w && h + gap * 2 <= screen.h)) return null;

  let x = anchor.x;
  let y = anchor.y;
  const clamp = () => {
    x = Math.min(screen.w - gap - w / 2, Math.max(gap + w / 2, x));
    y = Math.min(screen.h - gap - h / 2, Math.max(gap + h / 2, y));
  };
  clamp();

  const blocked = cards.map((card) => ({
    left: card.left - gap,
    top: card.top - gap,
    right: card.right + gap,
    bottom: card.bottom + gap,
  }));

  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (const card of blocked) {
      const box = labelBox(x, y, w, h);
      if (!intersects(box, card)) continue;
      const options = [
        { dx: card.left - box.right, dy: 0 },
        { dx: card.right - box.left, dy: 0 },
        { dx: 0, dy: card.top - box.bottom },
        { dx: 0, dy: card.bottom - box.top },
      ].sort((a, b) => Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)));
      let placed = false;
      for (const opt of options) {
        const nx = x + opt.dx;
        const ny = y + opt.dy;
        const next = labelBox(nx, ny, w, h);
        if (next.left < gap || next.top < gap || next.right > screen.w - gap || next.bottom > screen.h - gap) continue;
        x = nx;
        y = ny;
        placed = true;
        moved = true;
        break;
      }
      if (!placed) return null;
    }
    if (!moved) break;
  }

  const finalBox = labelBox(x, y, w, h);
  if (finalBox.left < gap - 0.5 || finalBox.top < gap - 0.5 || finalBox.right > screen.w - gap + 0.5 || finalBox.bottom > screen.h - gap + 0.5) {
    return null;
  }
  for (const card of blocked) {
    if (intersects(finalBox, card)) return null;
  }
  return { x, y };
}
