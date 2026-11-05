import { forwardRef } from 'react';
import { cx } from './shared.mjs';


export const PitchButton = forwardRef(function PitchButton(
  { variant = 'primary', loading = false, disabled = false, children, icon, className, type = 'button', ...rest }, ref,
) {
  return <button {...rest} ref={ref} type={type} className={cx('pl-button', `pl-button--${variant}`, className)}
    disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading ? <span className="pl-spinner" aria-hidden="true" /> : icon}
    <span>{children}</span>
  </button>;
});
