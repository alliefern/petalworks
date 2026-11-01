import { store } from '../app/store';
import { EXTRA } from './strings';

export function Notices() {
  const notices = store.ui.notices;
  return (
    <div className="notices" role="status" aria-live="polite" aria-atomic="true" aria-label={EXTRA.a11y.notices}>
      {notices.map((n) => (
        <div key={n.id} className={'notice ' + n.tone} data-testid="notice">
          {n.text}
        </div>
      ))}
    </div>
  );
}
