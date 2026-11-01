import { useState } from 'react';
import { store } from '../app/store';
import { audio } from '../app/audio';
import { Icon } from './Icon';
import { COPY, EXTRA } from './strings';

export function TitleScreen({ ready }: { ready: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const ui = store.ui;
  const loadingLabel = `${EXTRA.title.loadingGarden}… ${Math.round(ui.loadProgress * 100)}%`;
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
        <h1>{COPY.title.name}</h1>
        <p className="tag">{COPY.title.tagline}</p>
        {!ready && (
          <div className="loading" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ui.loadProgress * 100)} aria-label={loadingLabel} data-testid="loading">
            <div className="loading-bar">
              <span style={{ width: `${Math.round(ui.loadProgress * 100)}%` }} />
            </div>
            <div className="loading-text">{loadingLabel}</div>
          </div>
        )}
        <div className="actions">
          {ui.hasSave && (
            <button
              className="btn primary"
              disabled={!ready}
              onClick={() => {
                audio.unlock();
                store.continueGame();
              }}
              title={COPY.title.continueHint}
              data-testid="continue"
            >
              {COPY.title.continue}
            </button>
          )}
          {ui.hasSave && !confirm ? (
            <button className="btn" disabled={!ready} onClick={() => setConfirm(true)} data-testid="new-game">
              {COPY.title.newGame}
            </button>
          ) : ui.hasSave && confirm ? (
            <div className="confirm" role="alertdialog" aria-label={COPY.newGameConfirm.title}>
              <p>
                <b>{COPY.newGameConfirm.title}</b> {COPY.newGameConfirm.body}
              </p>
              <button className="btn danger" disabled={!ready} onClick={start} data-testid="new-game-confirm">
                {COPY.newGameConfirm.confirm}
              </button>
              <button className="btn" onClick={() => setConfirm(false)}>
                {COPY.newGameConfirm.cancel}
              </button>
            </div>
          ) : (
            <button className="btn primary" disabled={!ready} onClick={start} data-testid="new-game">
              {COPY.title.newGame}
            </button>
          )}
        </div>
        {ui.saveProblem && (
          <div className="problem" role="alert">
            <b>{COPY.save.unreadableTitle}.</b> {ui.saveProblem}
          </div>
        )}
        <p className="footnote">
          {COPY.title.savedHere} {COPY.title.soundHint}
        </p>
      </div>
    </div>
  );
}
