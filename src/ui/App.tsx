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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (store.ui.screen !== 'game') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (store.ui.settingsOpen || store.ui.completionOpen) {
        if (e.key === 'Escape') store.setUi({ settingsOpen: false });
        return;
      }
      const key = e.key.toLowerCase();
      switch (key) {
        case 'r': {
          if (store.ui.tool.type === 'build') store.rotateBuildFacing();
          else if (store.ui.selectedId !== null) store.dispatch({ type: 'rotate', id: store.ui.selectedId });
          else store.rotateBuildFacing();
          break;
        }
        case 'escape':
          if (store.ui.tool.type !== 'select') store.setTool({ type: 'select' });
          else if (store.ui.selectedId !== null) store.select(null);
          break;
        case 'z':
          if (!e.metaKey || e.ctrlKey || true) store.dispatch({ type: 'undo' });
          break;
        case 'delete':
        case 'backspace':
          if (store.ui.selectedId !== null) store.dispatch({ type: 'remove', id: store.ui.selectedId });
          break;
        case ' ':
          e.preventDefault();
          store.togglePause();
          break;
        case '1':
        case '2':
        case '3':
          store.setSpeed(Number(key) as 1 | 2 | 3);
          break;
        case 'b':
          store.setTool({ type: 'build', kind: 'belt' });
          break;
        case 'x':
          store.setTool(store.ui.tool.type === 'remove' ? { type: 'select' } : { type: 'remove' });
          break;
        case 'h':
          store.setUi({ tutorialOpen: !store.ui.tutorialOpen });
          break;
        case 'f':
          sceneRef.current?.recenter();
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

  const reduced = store.reducedMotion();

  return (
    <div className={'app' + (reduced ? ' reduced' : '')} onPointerDown={() => audio.unlock()}>
      <div className="world" ref={worldRef} aria-label="Garden" />
      {ui.screen === 'title' && <TitleScreen ready={sceneReady} />}
      {ui.screen === 'game' && (
        <div className="hud">
          <TopBar onRecenter={() => sceneRef.current?.recenter()} onZoom={(f) => sceneRef.current?.zoomBy(f)} />
          <OrderPanel />
          <Notices />
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
