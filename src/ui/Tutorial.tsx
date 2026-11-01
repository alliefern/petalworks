import { useState } from 'react';
import { store } from '../app/store';
import { COPY, EXTRA } from './strings';
import { tutorialStepFor } from './tutorial';

export function Tutorial() {
  const [seenOrder, setSeenOrder] = useState(false);
  const step = tutorialStepFor(store.sim.world, seenOrder);
  if (!step) {
    return (
      <aside className="card tutorial" aria-label={COPY.howTo.title} data-testid="howto">
        <h4>{COPY.howTo.title}</h4>
        <p>{COPY.howTo.intro}</p>
        <p>{EXTRA.tutorial.mouse}</p>
        <p className="muted">{COPY.howTo.skipNote}</p>
        <div className="actions">
          <button className="btn" onClick={() => store.setUi({ tutorialOpen: false })}>
            {COPY.howTo.close}
          </button>
        </div>
      </aside>
    );
  }
  const next = () => {
    if (step.id === 'see-order') setSeenOrder(true);
    else store.setUi({ tutorialOpen: false });
  };
  return (
    <aside className="card tutorial" aria-label={COPY.howTo.title} data-testid="tutorial">
      <h4>
        <span>{step.title}</span>
      </h4>
      <p>{step.body}</p>
      <div className="actions">
        <button className="btn quiet" onClick={() => store.dismissTutorial()} data-testid="tutorial-skip" title={COPY.tutorial.skipped}>
          {COPY.tutorial.skip}
        </button>
        <button className="btn" onClick={next}>
          {step.id === 'see-order' ? COPY.tutorial.next : COPY.tutorial.gotIt}
        </button>
      </div>
    </aside>
  );
}
