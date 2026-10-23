import {C,S,T,R} from '../theme';
import {t} from '../lib/i18n';
import '../lib/homeContextCopy';
const labels={player:'Jogador',rivals:'PITCH Rivals',league:'Organização de Liga'};
export default function HomeContextSwitcher({options=[],value,onChange,links=false}) {
  if(options.length<2)return null;
  return <div style={{padding:`${S.sm}px ${S.lg}px`,borderBottom:`1px solid ${C.border}`}}>
    <label style={{display:'flex',alignItems:'center',gap:S.md,fontSize:T.meta,color:C.text2}}>
      {t('O teu espaço')}
      <select aria-label={t('O teu espaço')} value={value} onChange={e=>links?window.location.assign(`/?context=${e.target.value}`):onChange(e.target.value)}
        style={{flex:1,minWidth:0,minHeight:44,border:`1px solid ${C.border}`,borderRadius:R.control,background:C.surface,color:C.text1,padding:'0 10px',font:'inherit',fontWeight:700}}>
        {options.map(id=><option key={id} value={id}>{t(labels[id])}</option>)}
      </select>
    </label>
  </div>;
}
