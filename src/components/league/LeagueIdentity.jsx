import { useState } from 'react';
import { C, S, T, R } from '../../theme';
import { t } from '../../lib/i18n';
import '../../lib/leaguePresentationCopy';
import { leagueMonogram, safeLeagueLogo } from '../../lib/leaguePresentation';

export default function LeagueIdentity({ league }) {
  const logo = safeLeagueLogo(league.logoUrl);
  const [failed, setFailed] = useState(null);
  const color = /^#[0-9a-f]{6}$/i.test(league.color || '') ? league.color : C.accent;
  return <section aria-label={t('Identidade da liga')} style={{ background: C.surface, border: `1px solid ${C.border}`,
    borderTop: `3px solid ${color}`, borderRadius: R.card, padding: S.lg, marginBottom: S.xl }}>
    <div style={{ display: 'flex', gap: S.md, alignItems: 'center' }}>
      {logo && failed !== logo ? <img src={logo} alt={league.name} referrerPolicy="no-referrer" onError={() => setFailed(logo)}
        style={{ width: 64, height: 64, objectFit: 'contain', flexShrink: 0 }} />
        : <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: R.control, background: C.card,
          color: C.text1, display: 'grid', placeItems: 'center', fontSize: T.h, fontWeight: 900, flexShrink: 0 }}>{leagueMonogram(league.shortName || league.name)}</span>}
      <div style={{ minWidth: 0 }}><div style={{ fontSize: T.h, fontWeight: 900, overflowWrap: 'anywhere' }}>{league.shortName || league.name}</div>
        <div style={{ color: C.text2, fontSize: T.meta, marginTop: S.xs }}>{[league.city, league.country].filter(Boolean).join(' · ')}</div></div>
    </div>
    {league.description ? <p style={{ color: C.text1, fontSize: T.body, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: `${S.lg}px 0 0` }}>{league.description}</p> : null}
  </section>;
}
