import { useState } from 'react';
import { store } from '../app/store';
import { audio } from '../app/audio';
import { Icon } from './Icon';
import { S } from './strings';

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
        <h1>{S.title.name}</h1>
        <p className="tag">{S.title.tagline}</p>
        <div className="actions">
          {ui.hasSave && (
            <button
              className="btn primary"
              disabled={!ready}
              onClick={() => {
                audio.unlock();
                store.continueGame();
              }}
              title={S.title.continueHint}
              data-testid="continue"
            >
              {S.title.continue}
            </button>
          )}
          {ui.hasSave && !confirm ? (
            <button className="btn" disabled={!ready} onClick={() => setConfirm(true)} data-testid="new-game">
              {S.title.newGame}
            </button>
          ) : ui.hasSave && confirm ? (
            <div className="confirm" role="alertdialog" aria-label={S.newGameConfirm.title}>
              <p>
                <b>{S.newGameConfirm.title}</b> {S.newGameConfirm.body}
              </p>
              <button className="btn danger" disabled={!ready} onClick={start} data-testid="new-game-confirm">
                {S.newGameConfirm.confirm}
              </button>
              <button className="btn" onClick={() => setConfirm(false)}>
                {S.newGameConfirm.cancel}
              </button>
            </div>
          ) : (
            <button className="btn primary" disabled={!ready} onClick={start} data-testid="new-game">
              {S.title.newGame}
            </button>
          )}
        </div>
        {ui.saveProblem && (
          <p className="problem">
            <b>{S.save.unreadableTitle}.</b> {ui.saveProblem}
          </p>
        )}
        <p className="footnote">
          {S.title.savedHere} {S.title.soundHint}
        </p>
      </div>
    </div>
  );
}
