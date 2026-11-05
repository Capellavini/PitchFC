import { createLeaguePalette } from '../pitch-tokens.mjs';
import { cx } from './shared.mjs';


export function PitchSurface({ appearance = 'app', leagueColor, children, className, style, ...rest }) {
  return <div {...rest} className={cx('pitch-redesign', 'pl-surface', className)}
    data-surface={appearance === 'public' ? 'public' : 'app'}
    style={{ ...(appearance === 'public' ? createLeaguePalette(leagueColor) : {}), ...style }}>{children}</div>;
}
