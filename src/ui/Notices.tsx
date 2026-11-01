import { store } from '../app/store';

export function Notices() {
  const notices = store.ui.notices;
  return (
    <div className="notices" role="status" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={'notice ' + n.tone}>
          {n.text}
        </div>
      ))}
    </div>
  );
}
