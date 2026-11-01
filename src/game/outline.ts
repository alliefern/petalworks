/**
 * Organic plot outline: traces the boundary of a set of tiles, then smooths it into a
 * wobbly hand-drawn curve (Chaikin corner cutting plus a small seeded wobble). Pure
 * geometry, no Phaser, so it is unit-tested; the scene only draws the result.
 */
export interface Pt {
  x: number;
  y: number;
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * Boundary loops of a tile set, in tile units, counter-clockwise around the inside
 * (y down on screen). Each loop is a closed polygon of grid corners.
 */
export function traceLoops(tiles: Iterable<Pt>): Pt[][] {
  const set = new Set<string>();
  for (const t of tiles) set.add(key(t.x, t.y));
  const has = (x: number, y: number) => set.has(key(x, y));
  // Directed edges: keep the open tile on the left when walking.
  const edges = new Map<string, Pt>(); // from corner -> to corner
  for (const k of set) {
    const [x, y] = k.split(',').map(Number);
    if (!has(x, y - 1)) edges.set(key(x, y), { x: x + 1, y }); // top edge, walking east
    if (!has(x + 1, y)) edges.set(key(x + 1, y), { x: x + 1, y: y + 1 }); // right edge, south
    if (!has(x, y + 1)) edges.set(key(x + 1, y + 1), { x, y: y + 1 }); // bottom edge, west
    if (!has(x - 1, y)) edges.set(key(x, y + 1), { x, y }); // left edge, north
  }
  const loops: Pt[][] = [];
  while (edges.size) {
    const [startKey] = edges.keys();
    const [sx, sy] = startKey.split(',').map(Number);
    const loop: Pt[] = [];
    let cur = { x: sx, y: sy };
    let guard = 0;
    while (guard++ < 100000) {
      const next = edges.get(key(cur.x, cur.y));
      if (!next) break;
      edges.delete(key(cur.x, cur.y));
      loop.push(cur);
      cur = next;
      if (cur.x === sx && cur.y === sy) break;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  // Largest first.
  loops.sort((a, b) => b.length - a.length);
  return loops;
}

/** Signed area (positive when counter-clockwise in a y-down system means the loop winds like our tracer). */
export function signedArea(loop: Pt[]): number {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % loop.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Drop collinear points so straight runs become single segments. */
export function simplify(loop: Pt[]): Pt[] {
  const out: Pt[] = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[(i - 1 + n) % n];
    const b = loop[i];
    const c = loop[(i + 1) % n];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  return out;
}

/** One Chaikin pass on a closed loop (corner cutting at 1/4 and 3/4). */
export function chaikin(loop: Pt[], iterations = 2): Pt[] {
  let pts = loop;
  for (let it = 0; it < iterations; it++) {
    const next: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      next.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 });
      next.push({ x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 });
    }
    pts = next;
  }
  return pts;
}

/** Resample a closed loop to roughly even spacing. */
export function resample(loop: Pt[], spacing: number): Pt[] {
  const out: Pt[] = [];
  const n = loop.length;
  let carry = 0;
  for (let i = 0; i < n; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    let d = carry;
    while (d < len) {
      out.push({ x: p.x + (dx * d) / len, y: p.y + (dy * d) / len });
      d += spacing;
    }
    carry = d - len;
  }
  return out;
}

function hash(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise over arc index, deterministic per seed. */
function noise(i: number, seed: number, period: number): number {
  const t = i / period;
  const i0 = Math.floor(t);
  const f = t - i0;
  const a = hash(i0 + seed * 1000) * 2 - 1;
  const b = hash(i0 + 1 + seed * 1000) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

/**
 * Push points along their normals by a small, smoothly varying amount so the curve
 * reads as hand-drawn: a few long gentle lumps plus finer ripples.
 */
export function wobble(loop: Pt[], amount: number, seed: number): Pt[] {
  const n = loop.length;
  return loop.map((p, i) => {
    const a = loop[(i - 1 + n) % n];
    const c = loop[(i + 1) % n];
    const tx = c.x - a.x;
    const ty = c.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const w = amount * (0.7 * noise(i, seed, 9) + 0.3 * noise(i, seed + 7, 3));
    return { x: p.x + nx * w, y: p.y + ny * w };
  });
}

/** Offset a closed loop outward (positive) along vertex normals. */
export function offset(loop: Pt[], dist: number): Pt[] {
  const n = loop.length;
  const ccw = signedArea(loop) > 0;
  return loop.map((p, i) => {
    const a = loop[(i - 1 + n) % n];
    const c = loop[(i + 1) % n];
    const tx = c.x - a.x;
    const ty = c.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    // Normal pointing outward for this winding.
    const nx = (ccw ? 1 : -1) * (ty / len);
    const ny = (ccw ? 1 : -1) * (-tx / len);
    return { x: p.x + nx * dist, y: p.y + ny * dist };
  });
}

/**
 * Full pipeline: tiles -> smooth wobbly loops in world pixels.
 * `tile` is the tile size; `seed` keeps the wobble stable between rebuilds.
 */
export function organicOutline(tiles: Iterable<Pt>, tile: number, seed: number, wobbleAmount = tile * 0.18): Pt[][] {
  return traceLoops(tiles).map((loop) => {
    const px = simplify(loop).map((p) => ({ x: p.x * tile, y: p.y * tile }));
    const dense = resample(px, tile / 2);
    const smooth = chaikin(dense, 3);
    const even = resample(smooth, tile / 4);
    return wobble(even, wobbleAmount, seed);
  });
}

/** Point-in-polygon (even-odd) for a closed loop. */
export function inside(loop: Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i];
    const b = loop[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
