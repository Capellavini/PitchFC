import { useState } from 'react';
import { C, S, T, cardStyle, inputStyle } from '../../theme';
import { t } from '../../lib/i18n';
import '../../lib/leaguePresentationCopy';
import { leagueIdentityFields } from '../../lib/leaguePresentation';
import { leagueCloudError } from '../../lib/leagueCloudCopy';
import BtnPrimary from '../BtnPrimary';
import SectionLabel from '../SectionLabel';
import LeagueIdentity from './LeagueIdentity';

const messages = {
  name: 'Usa um nome entre 2 e 80 caracteres.', shortName: 'O nome curto pode ter até 24 caracteres.',
  description: 'A apresentação pode ter até 2000 caracteres.', color: 'Escolhe uma cor válida.',
  logoUrl: 'Usa um endereço HTTPS de imagem, sem credenciais.',
};
export default function LeagueIdentityEditor({ leagues, league, onChanged }) {
  const [draft, setDraft] = useState(() => ({ name: league.name, shortName: league.shortName || '',
    description: league.description || '', logoUrl: league.logoUrl || '', color: league.color || C.accent }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const set = (key, value) => { setDraft(d => ({ ...d, [key]: value })); setNotice(null); setError(null); };
  const save = async event => {
    event.preventDefault();
    const fields = leagueIdentityFields(draft);
    if (fields.error) { setError(t(messages[fields.error])); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await leagues.updateLeague(league.id, fields.data);
      if (result.error) setError(leagueCloudError(result.error));
      else { await onChanged?.(); setNotice(t('Identidade atualizada.')); }
    } catch { setError(t('Não foi possível guardar. Tenta outra vez.')); }
    finally { setBusy(false); }
  };
  const field = (key, label, limit, type = 'text') => <label style={{ display: 'block', marginBottom: S.md }}>
    <span style={{ display: 'block', color: C.text2, fontSize: T.meta, marginBottom: S.xs }}>{t(label)}</span>
    <input type={type} value={draft[key]} maxLength={limit} disabled={busy} onChange={e => set(key, e.target.value)} style={inputStyle()} />
  </label>;
  return <details style={{ ...cardStyle, padding: S.lg, marginTop: S.lg }}>
    <summary style={{ cursor: 'pointer', minHeight: 44, fontWeight: 800, fontSize: T.body }}>{t('Identidade da liga')}</summary>
    <form onSubmit={save} style={{ marginTop: S.md }}>
      {field('name', 'Nome público', 80)}
      {field('shortName', 'Nome curto', 24)}
      <label style={{ display: 'block', marginBottom: S.md }}><span style={{ display: 'block', color: C.text2, fontSize: T.meta, marginBottom: S.xs }}>{t('Apresentação')}</span>
        <textarea aria-label={t('Apresentação')} value={draft.description} maxLength={2000} rows={4} disabled={busy} onChange={e => set('description', e.target.value)} style={{ ...inputStyle(), resize: 'vertical', minHeight: 100 }} />
      </label>
      {field('logoUrl', 'Emblema (endereço HTTPS)', 2048, 'url')}
      <p style={{ color: C.text2, fontSize: T.meta, lineHeight: 1.5 }}>{t('Partilha apenas um emblema que tenhas autorização para usar.')}</p>
      <label style={{ display: 'flex', alignItems: 'center', gap: S.md, minHeight: 44, marginBottom: S.lg, fontSize: T.body }}>
        {t('Cor da liga')}<input aria-label={t('Cor da liga')} type="color" value={draft.color} disabled={busy} onChange={e => set('color', e.target.value)} style={{ width: 64, minHeight: 44 }} />
      </label>
      <SectionLabel>{t('Prévia')}</SectionLabel>
      <LeagueIdentity league={{ ...league, ...draft }} />
      <BtnPrimary type="submit" disabled={busy || league.status === 'archived'} block>{t(busy ? 'A guardar…' : 'Guardar identidade')}</BtnPrimary>
      {error ? <p role="alert" style={{ color: C.red, fontSize: T.meta }}>{error}</p> : null}
      {notice ? <p role="status" style={{ color: C.green, fontSize: T.meta }}>{notice}</p> : null}
      <p style={{ color: C.text2, fontSize: T.meta, lineHeight: 1.5 }}>{t('Guardar a identidade não publica a liga nem altera os acessos.')} {t('O endereço da liga mantém-se após mudar o nome.')}</p>
    </form>
  </details>;
}
