import { useEffect, useRef, useState } from 'react';
import { store } from '../app/store';

function Toggle({ value, options, onChange, label }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void; label: string }) {
  return (
    <div className="toggle" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function SettingsModal() {
  const s = store.ui.settings;
  const [confirmNew, setConfirmNew] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <div className="overlay" onClick={() => store.setUi({ settingsOpen: false })}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <p>The game is paused while this is open.</p>
        <div className="setting">
          <div>
            <div>Sound effects</div>
            <div className="desc">Soft taps, pops and chimes.</div>
          </div>
          <Toggle label="Sound effects" value={s.soundOn ? 'on' : 'off'} options={[['on', 'On'], ['off', 'Off']]} onChange={(v) => store.updateSettings({ soundOn: v === 'on' })} />
        </div>
        <div className="setting">
          <div>
            <div>Music</div>
            <div className="desc">A quiet garden hum.</div>
          </div>
          <Toggle label="Music" value={s.musicOn ? 'on' : 'off'} options={[['on', 'On'], ['off', 'Off']]} onChange={(v) => store.updateSettings({ musicOn: v === 'on' })} />
        </div>
        <div className="setting">
          <div>
            <div>Reduced motion</div>
            <div className="desc">Turns off bounces, sparkles and belt animation. Items still move so you can see the flow.</div>
          </div>
          <Toggle label="Reduced motion" value={s.reducedMotion} options={[['system', 'System'], ['on', 'On'], ['off', 'Off']]} onChange={(v) => store.updateSettings({ reducedMotion: v as 'system' | 'on' | 'off' })} />
        </div>
        <div className="setting">
          <div>
            <div>Tutorial</div>
            <div className="desc">Show the contextual hints again.</div>
          </div>
          <button className="btn" onClick={() => { store.updateSettings({ tutorialDismissed: false }); store.setUi({ tutorialOpen: true, settingsOpen: false }); }}>
            Reopen
          </button>
        </div>
        <div className="setting">
          <div>
            <div>Start over</div>
            <div className="desc">Clears this garden and starts a fresh one. Cannot be undone.</div>
          </div>
          {confirmNew ? (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button className="btn danger" onClick={() => { store.setUi({ settingsOpen: false }); store.newGame(); }}>
                Yes, start over
              </button>
              <button className="btn" onClick={() => setConfirmNew(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button className="btn" onClick={() => setConfirmNew(true)}>
              New game…
            </button>
          )}
        </div>
        <h2 style={{ fontSize: 16, marginTop: 14 }}>Controls</h2>
        <ul className="controls-list">
          <li><b>Click</b> place / select</li>
          <li><b>Drag</b> lay belts (belt tool)</li>
          <li><b>R</b> rotate</li>
          <li><b>Z</b> undo build</li>
          <li><b>X</b> remove tool</li>
          <li><b>Delete</b> remove selected</li>
          <li><b>Esc / right-click</b> cancel</li>
          <li><b>Space</b> pause</li>
          <li><b>1 2 3</b> speed</li>
          <li><b>Wheel</b> zoom</li>
          <li><b>Middle-drag</b> pan</li>
          <li><b>F</b> fit garden</li>
          <li><b>H</b> help</li>
        </ul>
        <div className="actions">
          <button ref={first} className="btn primary" onClick={() => store.setUi({ settingsOpen: false })}>
            Back to the garden
          </button>
        </div>
      </div>
    </div>
  );
}
