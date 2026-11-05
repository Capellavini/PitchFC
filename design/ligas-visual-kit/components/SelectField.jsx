import { useId } from 'react';
import { cx } from './shared.mjs';


export function SelectField({ label, options, className, id: suppliedId, ...props }) {
  const generatedId = useId(); const id = suppliedId || generatedId;
  return <label className={cx('pl-select-field', className)} htmlFor={id}><span>{label}</span>
    <select {...props} id={id}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
  </label>;
}
