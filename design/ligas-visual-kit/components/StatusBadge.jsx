import { cx, STATE_LABELS } from './shared.mjs';


export function StatusBadge({ state = 'scheduled', label, className }) {
  return <span className={cx('pl-status', `pl-status--${state}`, className)}>
    <span className="pl-status-dot" aria-hidden="true" />{label || STATE_LABELS[state] || 'Estado por confirmar'}
  </span>;
}
