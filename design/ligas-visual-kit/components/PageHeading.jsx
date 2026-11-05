import { cx } from './shared.mjs';


export function PageHeading({ eyebrow, title, description, actions, football = true }) {
  return <header className="pl-page-heading"><div>
    {eyebrow && <p className={cx('pl-eyebrow', football && 'pl-eyebrow--flag')}>{eyebrow}</p>}
    <h1>{title}</h1>{description && <p className="pl-description">{description}</p>}
  </div>{actions && <div className="pl-heading-actions">{actions}</div>}</header>;
}
