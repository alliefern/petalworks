import { useEffect, useRef, useState } from 'react';
import { store } from '../app/store';
import { audio } from '../app/audio';
import { createGame } from '../game/createGame';
import type { PetalScene } from '../game/PetalScene';
import { useStoreVersion } from './useStore';
import { TopBar } from './TopBar';
import { OrderPanel } from './OrderPanel';
import { Palette } from './Palette';
import { Inspector } from './Inspector';
import { Notices } from './Notices';
import { Tutorial } from './Tutorial';
import { SettingsModal } from './SettingsModal';
import { CompletionModal } from './CompletionModal';
import { TitleScreen } from './TitleScreen';
import { BuildHint } from './BuildHint';
import { CelebrationCard } from './CelebrationCard';
import { COPY, EXTRA } from './strings';

const GARDEN_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D']);

export function App() {
  useStoreVersion();
  const worldRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PetalScene | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const ui = store.ui;

  useEffect(() => {
    if (!worldRef.current || sceneRef.current) return;
    const { game, scene } = createGame(worldRef.current, store);
    sceneRef.current = scene;
    const check = () => {
      if (scene.ready) setSceneReady(true);
      else requestAnimationFrame(check);
    };
    check();
    return () => {
      game.destroy(true);
      sceneRef.current = null;
    };
  }, []);

  // Frame the used area whenever a game starts (new or continued).
  const screen = ui.screen;
  useEffect(() => {
    if (screen === 'game') requestAnimationFrame(() => sceneRef.current?.frameUsedArea());
  }, [screen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (store.ui.screen !== 'game') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      // Dialogs own their keys (focus trap + Esc).
      if (store.ui.settingsOpen || store.ui.completionOpen) return;
      // Leave browser shortcuts alone: only Ctrl/Cmd+Z is ours.
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          store.dispatch({ type: 'undo' });
        }
        return;
      }
      if (e.altKey) return;
      const inHud = !!target && !!target.closest('.hud');
      const gardenFocused = !inHud;
      if (GARDEN_KEYS.has(e.key) && !gardenFocused) return; // let buttons use Enter/Space/arrows
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          store.moveCursor(0, -1);
          return;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          store.moveCursor(0, 1);
          return;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          store.moveCursor(-1, 0);
          return;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          store.moveCursor(1, 0);
          return;
        case 'Enter':
        case ' ':
          e.preventDefault();
          store.activateCursor();
          return;
        case 'Escape':
          store.cancel();
          return;
        case 'Home':
          e.preventDefault();
          sceneRef.current?.recenter();
          return;
        case '=':
        case '+':
          sceneRef.current?.zoomBy(1.2);
          return;
        case '-':
        case '_':
          sceneRef.current?.zoomBy(1 / 1.2);
          return;
        case 'Delete':
          if (store.ui.selectedId !== null) store.dispatch({ type: 'remove', id: store.ui.selectedId });
          return;
        default:
          break;
      }
      switch (e.key.toLowerCase()) {
        case 'r':
          store.rotate(e.shiftKey);
          break;
        case 'z':
          store.dispatch({ type: 'undo' });
          break;
        case 'x':
          store.setTool(store.ui.tool.type === 'remove' ? { type: 'select' } : { type: 'remove' });
          break;
        case 'b':
          store.setUi({ paletteOpen: !store.ui.paletteOpen });
          if (!store.ui.paletteOpen) return;
          requestAnimationFrame(() => document.querySelector<HTMLElement>('.palette .ptool')?.focus());
          break;
        case 'p':
          store.togglePause();
          break;
        case 'm':
          store.toggleMute();
          break;
        case 'f':
          store.cycleSpeed();
          break;
        case 'h':
          store.setUi({ tutorialOpen: !store.ui.tutorialOpen });
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    const onVisibility = () => store.save();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onVisibility);
    };
  }, []);

  return (
    <div className="app" onPointerDown={() => audio.unlock()}>
      <div
        className="world"
        ref={worldRef}
        role="application"
        aria-label={COPY.a11y.game}
        aria-describedby="garden-help"
        tabIndex={ui.screen === 'game' ? 0 : -1}
      />
      <span id="garden-help" className="sr-only">
        {EXTRA.a11y.gameHelp}
      </span>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ui.announce}
      </div>
      {ui.screen === 'title' && <TitleScreen ready={sceneReady} />}
      {ui.screen === 'game' && (
        <div className="hud">
          <a className="skip-link" href="#" onClick={(e) => { e.preventDefault(); worldRef.current?.focus(); }}>
            {EXTRA.a11y.skipToGarden}
          </a>
          <TopBar onRecenter={() => sceneRef.current?.recenter()} onZoom={(f) => sceneRef.current?.zoomBy(f)} />
          <OrderPanel />
          <Notices />
          {ui.celebration && <CelebrationCard />}
          {ui.tutorialOpen && <Tutorial />}
          <Inspector />
          <Palette />
          <BuildHint />
          {ui.settingsOpen && <SettingsModal />}
          {ui.completionOpen && <CompletionModal />}
        </div>
      )}
    </div>
  );
}
