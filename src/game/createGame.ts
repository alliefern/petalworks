import Phaser from 'phaser';
import type { GameStore } from '../app/store';
import { COLORS } from './constants';
import { PetalScene } from './PetalScene';

export function createGame(parent: HTMLElement, store: GameStore): { game: Phaser.Game; scene: PetalScene } {
  const scene = new PetalScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: COLORS.linen,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    input: { mouse: { preventDefaultWheel: true } },
    scene: [],
    audio: { noAudio: true },
    banner: false,
  });
  game.scene.add('petal', scene, true, { store });
  return { game, scene };
}
