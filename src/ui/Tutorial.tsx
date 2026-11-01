import { store } from '../app/store';
import { tutorialStepFor } from './tutorial';

function rich(text: string) {
  // **bold** → <b>, keeps it tiny and dependency-free
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>));
}

export function Tutorial() {
  const step = tutorialStepFor(store.sim.world);
  if (!step) {
    return (
      <aside className="card tutorial" aria-label="Help">
        <h4>Help</h4>
        <p>
          <kbd>R</kbd> rotate · <kbd>Z</kbd> undo · <kbd>X</kbd> remove tool · <kbd>B</kbd> belt · <kbd>Esc</kbd> cancel · <kbd>Space</kbd> pause · <kbd>1</kbd>
          <kbd>2</kbd>
          <kbd>3</kbd> speed · <kbd>F</kbd> fit view
        </p>
        <p>Drag on empty lawn or use the middle mouse button to pan. Scroll to zoom. Click any machine for details.</p>
        <div className="actions">
          <button className="btn" onClick={() => store.setUi({ tutorialOpen: false })}>
            Close
          </button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="card tutorial" aria-label="Tutorial" data-testid="tutorial">
      <h4>
        <span>{step.title}</span>
      </h4>
      <p>{rich(step.body)}</p>
      <div className="actions">
        <button className="btn quiet" onClick={() => store.dismissTutorial()} title="Hide the tutorial. Press H or the ? button to bring it back.">
          Skip tutorial
        </button>
        <button className="btn" onClick={() => store.setUi({ tutorialOpen: false })}>
          Got it
        </button>
      </div>
    </aside>
  );
}
