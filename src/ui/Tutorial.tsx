import { store } from '../app/store';
import { S } from './strings';
import { tutorialStepFor } from './tutorial';

function rich(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>));
}

export function Tutorial() {
  const step = tutorialStepFor(store.sim.world);
  if (!step) {
    return (
      <aside className="card tutorial" aria-label={S.tutorial.help}>
        <h4>{S.tutorial.help}</h4>
        <p>{S.tutorial.keys}</p>
        <p>{S.tutorial.mouse}</p>
        <div className="actions">
          <button className="btn" onClick={() => store.setUi({ tutorialOpen: false })}>
            {S.tutorial.close}
          </button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="card tutorial" aria-label={S.tutorial.help} data-testid="tutorial">
      <h4>
        <span>{step.title}</span>
      </h4>
      <p>{rich(step.body)}</p>
      <div className="actions">
        <button className="btn quiet" onClick={() => store.dismissTutorial()} data-testid="tutorial-skip">
          {S.tutorial.skip}
        </button>
        <button className="btn" onClick={() => store.setUi({ tutorialOpen: false })}>
          {S.tutorial.gotIt}
        </button>
      </div>
    </aside>
  );
}
