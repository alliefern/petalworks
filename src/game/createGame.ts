import Phaser from 'phaser';
import type { GameStore } from '../app/store';
import { renderScaleFor } from './camera';
import { COLORS } from './constants';
import { PetalScene } from './PetalScene';

/**
 * The canvas is sized by hand (Scale.NONE): `k` canvas pixels per CSS pixel, where k follows
 * the device pixel ratio within a pixel budget, so the garden is sharp on a 2x laptop and
 * still cheap on a 4K monitor. Phaser's `zoom` shrinks the canvas back to its CSS size and
 * maps pointer events into canvas pixels; the camera controller converts to CSS px.
 */
export function createGame(parent: HTMLElement, store: GameStore): { game: Phaser.Game; scene: PetalScene } {
  const scene = new PetalScene();
  const cssW = () => Math.max(1, parent.clientWidth || window.innerWidth);
  const cssH = () => Math.max(1, parent.clientHeight || window.innerHeight);
  let k = renderScaleFor(cssW(), cssH(), window.devicePixelRatio);
  scene.renderScale = k;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: COLORS.linen,
    scale: { mode: Phaser.Scale.NONE, width: Math.round(cssW() * k), height: Math.round(cssH() * k), zoom: 1 / k },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    input: { mouse: { preventDefaultWheel: true } },
    scene: [],
    audio: { noAudio: true },
    banner: false,
  });
  const resize = () => {
    const w = cssW();
    const h = cssH();
    k = renderScaleFor(w, h, window.devicePixelRatio);
    scene.setRenderScale(k);
    game.scale.setZoom(1 / k);
    game.scale.resize(Math.round(w * k), Math.round(h * k));
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(parent);
  window.addEventListener('resize', resize);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    ro?.disconnect();
    window.removeEventListener('resize', resize);
  });
  game.scene.add('petal', scene, true, { store });
  return { game, scene };
}
