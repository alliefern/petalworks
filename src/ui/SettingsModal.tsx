import { useCallback, useState } from 'react';
import { store } from '../app/store';
import { S } from './strings';
import { useFocusTrap } from './useFocusTrap';

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="toggle" role="radiogroup" aria-label={label}>
      <button role="radio" aria-checked={value} className={value ? 'on' : ''} onClick={() => onChange(true)}>
        {S.settings.on}
      </button>
      <button role="radio" aria-checked={!value} className={!value ? 'on' : ''} onClick={() => onChange(false)}>
        {S.settings.off}
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
      <div className="card modal" role="dialog" aria-modal="true" aria-label={S.settings.title} onClick={(e) => e.stopPropagation()} ref={ref} data-testid="settings-modal">
        <h2>{S.settings.title}</h2>
        <p>{S.settings.paused}</p>
        <div className="setting">
          <div>
            <div>{S.settings.sound}</div>
            <div className="desc">{S.settings.soundHelp}</div>
          </div>
          <Toggle label={S.settings.sound} value={s.sound} onChange={(v) => store.updateSettings({ sound: v })} />
        </div>
        <div className="setting">
          <div>
            <div>{S.settings.music}</div>
            <div className="desc">{S.settings.musicHelp}</div>
          </div>
          <Toggle label={S.settings.music} value={s.music} onChange={(v) => store.updateSettings({ music: v })} />
        </div>
        <div className="setting">
          <div>
            <div>{S.settings.reducedMotion}</div>
            <div className="desc">{S.settings.reducedMotionHelp}</div>
          </div>
          <Toggle label={S.settings.reducedMotion} value={s.reducedMotion} onChange={(v) => store.updateSettings({ reducedMotion: v })} />
        </div>
        <div className="setting">
          <div>
            <div>{S.settings.tutorial}</div>
            <div className="desc">{S.settings.tutorialHelp}</div>
          </div>
          <button
            className="btn"
            onClick={() => {
              store.updateSettings({ tutorialDismissed: false });
              store.setUi({ tutorialOpen: true, settingsOpen: false });
            }}
          >
            {S.settings.replay}
          </button>
        </div>
        <div className="setting">
          <div>
            <div>{S.settings.newGame}</div>
            <div className="desc">{S.settings.newGameHelp}</div>
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
                {S.newGameConfirm.confirm}
              </button>
              <button className="btn" onClick={() => setConfirmNew(false)}>
                {S.settings.keep}
              </button>
            </span>
          ) : (
            <button className="btn" onClick={() => setConfirmNew(true)} data-testid="settings-new-game">
              {S.settings.newGameButton}
            </button>
          )}
        </div>
        <h2 style={{ fontSize: 16, marginTop: 14 }}>{S.settings.controls}</h2>
        <ul className="controls-list">
          {S.controls.map(([key, action]) => (
            <li key={key}>
              <b>{key}</b> {action}
            </li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn primary" onClick={close} data-autofocus data-testid="settings-close">
            {S.settings.close}
          </button>
        </div>
      </div>
    </div>
  );
}
