import { createLeaguePalette } from '../pitch-tokens.mjs';
import { cx } from './shared.mjs';


export function LeagueCrest({ name, short, color, size = 'normal', imageUrl }) {
  const palette = createLeaguePalette(color);
  const initials = short || name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('');
  return <span aria-hidden="true" className={cx('pl-crest', `pl-crest--${size}`)}
    style={{ '--crest-bg': palette['--pitch-league-primary'], '--crest-fg': palette['--pitch-league-on-primary'] }}>
    {imageUrl ? <img src={imageUrl} alt="" /> : initials}
  </span>;
}
