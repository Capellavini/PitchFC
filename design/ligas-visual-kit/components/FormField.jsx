import { useId } from 'react';
import { cx } from './shared.mjs';


export function FormField({ label, hint, error, multiline = false, id: suppliedId, className, ...props }) {
  const generatedId = useId(); const id = suppliedId || generatedId;
  const describedBy = [props['aria-describedby'], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const Component = multiline ? 'textarea' : 'input';
  return <div className={cx('pl-form-field', className)}><label htmlFor={id}>{label}{props.required && <span> · obrigatório</span>}</label>
    <Component {...props} id={id} aria-invalid={error ? 'true' : props['aria-invalid']}
      aria-describedby={describedBy} />
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {error && <p id={`${id}-error`} className="pl-field-error" role="alert">{error}</p>}
  </div>;
}
