import { useState } from 'react';
import { store } from '../app/store';
import { audio } from '../app/audio';
import { Icon } from './Icon';

export function TitleScreen({ ready }: { ready: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const ui = store.ui;
  const start = () => {
    audio.unlock();
    store.newGame();
  };
  return (
    <div className="titlescreen">
      <div className="card" data-testid="title">
        <div className="meadow" aria-hidden>
          <Icon k="item.daisy" size={56} />
          <Icon k="item.mixed_bouquet" size={56} />
          <Icon k="item.lavender_sachet" size={56} />
        </div>
        <h1>Petalworks</h1>
        <p className="tag">Grow flowers. Lay belts. Fill the village’s orders.</p>
        <div className="actions">
          {ui.hasSave && (
            <button className="btn primary" disabled={!ready} onClick={() => { audio.unlock(); store.continueGame(); }} data-testid="continue">
              Continue
            </button>
          )}
          {ui.hasSave && !confirm ? (
            <button className="btn" disabled={!ready} onClick={() => setConfirm(true)} data-testid="new-game">
              New game
            </button>
          ) : ui.hasSave && confirm ? (
            <>
              <button className="btn danger" disabled={!ready} onClick={start} data-testid="new-game-confirm">
                Replace saved garden
              </button>
              <button className="btn" onClick={() => setConfirm(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button className="btn primary" disabled={!ready} onClick={start} data-testid="new-game">
              Start a garden
            </button>
          )}
        </div>
        {ui.saveProblem && <p className="problem">{ui.saveProblem}</p>}
        <p className="footnote">Desktop browser, mouse and keyboard. Nothing leaves your computer: progress saves locally.</p>
      </div>
    </div>
  );
}
