import { cx } from './shared.mjs';


export function Notice({ tone = 'info', title, children, action }) {
  return <div className={cx('pl-notice', `pl-notice--${tone}`)} role={tone === 'error' ? 'alert' : 'status'}>
    <div>{title && <strong>{title}</strong>}{children && <p>{children}</p>}</div>{action}
  </div>;
}
