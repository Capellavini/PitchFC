import {C,S,T} from '../theme';
import {t} from '../lib/i18n';
import SegmentedControl from './SegmentedControl';
import '../lib/homeContextCopy';
// Short chip labels (PT-PT source strings; SegmentedControl applies t()).
const labels={player:'Jogador',rivals:'PITCH Rivals',league:'Liga'};
/**
 * "O teu espaço" — Player · PITCH Rivals · League. Always-visible chips (not a
 * hidden dropdown): the Player space is where the group, its Fantasy and the
 * OVR ratings live, so switching must be obvious. Renders only when the
 * account actually has 2+ spaces. `links` = used on league pages, where a
 * switch is a navigation to `/?context=<id>`.
 */
export default function HomeContextSwitcher({options=[],value,onChange,links=false}) {
  if(options.length<2)return null;
  const choose=id=>links?window.location.assign(`/?context=${id}`):onChange(id);
  return <div style={{padding:`${S.sm}px ${S.lg}px 0`,borderBottom:`1px solid ${C.border}`}}>
    <div style={{fontSize:T.meta,color:C.text2,marginBottom:S.xs}}>{t('O teu espaço')}</div>
    <SegmentedControl options={options.map(id=>({id,label:labels[id]}))} value={value} onChange={choose} style={{marginBottom:S.sm}}/>
  </div>;
}
