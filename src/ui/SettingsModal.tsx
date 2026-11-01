import { useCallback, useState } from 'react';
import { store } from '../app/store';
import { COPY, EXTRA } from './strings';
import { useFocusTrap } from './useFocusTrap';

function Toggle({ value, onChange, label, onName, offName }: { value: boolean; onChange: (v: boolean) => void; label: string; onName: string; offName: string }) {
  return (
    <div className="toggle" role="radiogroup" aria-label={label}>
      <button role="radio" aria-checked={value} aria-label={onName} className={value ? 'on' : ''} onClick={() => onChange(true)}>
        {COPY.settings.on}
      </button>
      <button role="radio" aria-checked={!value} aria-label={offName} className={!value ? 'on' : ''} onClick={() => onChange(false)}>
        {COPY.settings.off}
      </button>
    </div>
  );
}

export function SettingsModal() {
  const s = store.ui.settings;
  const [confirmNew, setConfirmNew] = useState(false);
  const close = useCallback(() => store.setUi({ settingsOpen: false }), []);
  const ref = useFocusTrap<HTMLDivElement>(close);
  return (
    <div className="overlay" onClick={close}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={COPY.settings.title} onClick={(e) => e.stopPropagation()} ref={ref} data-testid="settings-modal">
        <h2>{COPY.settings.title}</h2>
        <p>{EXTRA.settings.paused}</p>
        <div className="setting">
          <div>
            <div>{COPY.settings.sound}</div>
            <div className="desc">{EXTRA.settings.soundHelp}</div>
          </div>
          <Toggle label={COPY.settings.sound} onName={COPY.a11y.soundOn} offName={COPY.a11y.soundOff} value={s.sound} onChange={(v) => store.updateSettings({ sound: v })} />
        </div>
        <div className="setting">
          <div>
            <div>{COPY.settings.music}</div>
            <div className="desc">{EXTRA.settings.musicHelp}</div>
          </div>
          <Toggle label={COPY.settings.music} onName={COPY.a11y.musicOn} offName={COPY.a11y.musicOff} value={s.music} onChange={(v) => store.updateSettings({ music: v })} />
        </div>
        <div className="setting">
          <div>
            <div>{COPY.settings.reducedMotion}</div>
            <div className="desc">{COPY.settings.reducedMotionHelp}</div>
          </div>
          <Toggle label={COPY.settings.reducedMotion} onName={COPY.a11y.reducedMotionOn} offName={COPY.a11y.reducedMotionOff} value={s.reducedMotion} onChange={(v) => store.updateSettings({ reducedMotion: v })} />
        </div>
        <div className="setting">
          <div>
            <div>{COPY.howTo.title}</div>
            <div className="desc">{COPY.howTo.skipNote}</div>
          </div>
          <button
            className="btn"
            onClick={() => {
              store.updateSettings({ tutorialDismissed: false });
              store.setUi({ tutorialOpen: true, settingsOpen: false });
            }}
          >
            {COPY.howTo.replay}
          </button>
        </div>
        <div className="setting">
          <div>
            <div>{EXTRA.settings.newGame}</div>
            <div className="desc">{EXTRA.settings.newGameHelp}</div>
          </div>
          {confirmNew ? (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button
                className="btn danger"
                onClick={() => {
                  store.setUi({ settingsOpen: false });
                  store.newGame();
                }}
                data-testid="settings-new-game-confirm"
              >
                {COPY.newGameConfirm.confirm}
              </button>
              <button className="btn" onClick={() => setConfirmNew(false)}>
                {COPY.newGameConfirm.cancel}
              </button>
            </span>
          ) : (
            <button className="btn" onClick={() => setConfirmNew(true)} data-testid="settings-new-game">
              {EXTRA.settings.newGameButton}
            </button>
          )}
        </div>
        <h2 style={{ fontSize: 16, marginTop: 14 }}>{COPY.howTo.controlsTitle}</h2>
        <ul className="controls-list">
          {COPY.controls.map((c) => (
            <li key={c.id}>
              <b>{c.input}</b> {c.action}
            </li>
          ))}
          {EXTRA.controlsExtra.map(([key, action]) => (
            <li key={key}>
              <b>{key}</b> {action}
            </li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn primary" onClick={close} data-autofocus data-testid="settings-close">
            {EXTRA.settings.backToGarden}
          </button>
        </div>
      </div>
    </div>
  );
}
