export const hasLocation = league => Number.isFinite(league.lat) && Number.isFinite(league.lng) && Math.abs(league.lat)<=90 && Math.abs(league.lng)<=180;
const number = n => Number(n).toLocaleString('pt-BR');
export function metricValue(league, key) {
  const evidence=league.metricEvidence?.[key],value=league[key];
  if(evidence?.display)return evidence.display;
  if(value==null)return '—';
  if(key==='athletes'&&league.athletesMax!=null&&league.athletesMax>value)return `${number(value)}–${number(league.athletesMax)}`;
  if(evidence?.qualifier==='lower_bound')return `${number(value)}+`;
  if(evidence?.qualifier==='historical')return `${number(value)} · histórico`;
  const approximate=evidence?['estimate','range'].includes(evidence.qualifier):league.quality==='estimate';
  return `${approximate?'~':''}${number(value)}`;
}
export function aggregateMetric(leagues,key) {
  const known=leagues.filter(l=>l[key]!=null&&l.metricEvidence?.[key]?.includeInTotals!==false);
  const minimum=known.reduce((s,l)=>s+l[key],0),maximum=known.reduce((s,l)=>s+(key==='athletes'&&l.athletesMax!=null?l.athletesMax:l[key]),0);
  const lowerBound=known.some(l=>l.metricEvidence?.[key]?.qualifier==='lower_bound');
  return {known:known.length,minimum,maximum,lowerBound,display:!known.length?'—':lowerBound?`${number(minimum)}+`:maximum>minimum?`${number(minimum)}–${number(maximum)}`:number(minimum)};
}
export function referenceDate(value){if(!value)return 'Data não informada';if(/^\d{4}$/.test(value))return value;if(/^\d{4}-\d{2}$/.test(value))return value.slice(5)+'/'+value.slice(0,4);return value.split('-').reverse().join('/')}
export function safeSource(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!/[?&](?:access_token|auth_signup_token|token|code)=/i.test(url.href)?url.href:null}catch{return null}}
