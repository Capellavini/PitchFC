export const teams = [
  { id:'operaria', name:'União Operária', short:'UO', color:'#765AA3' },
  { id:'mare', name:'Desportivo Maré Alta', short:'MA', color:'#92394E' },
  { id:'aurora', name:'Atlético Aurora', short:'AU', color:'#365E9E' },
  { id:'atlantico', name:'Ginásio Atlântico', short:'GA', color:'#92782E' },
  { id:'pinhal', name:'Recreativo do Pinhal', short:'RP', color:'#47705A' },
  { id:'ribeirinho', name:'Grupo Desportivo Ribeirinho', short:'GR', color:'#3B7468' },
  { id:'cais', name:'Juventude do Cais', short:'JC', color:'#687B35' },
  { id:'lobos', name:'Os Lobos do Vale', short:'LV', color:'#545287' },
  { id:'brisa', name:'Núcleo Desportivo Brisa', short:'NB', color:'#30788C' },
  { id:'casa', name:'Casa do Povo FC', short:'CP', color:'#49715E' },
];
export const standings = [
  { team:teams[0], position:1, played:10, wins:7, draws:2, losses:1, difference:14, points:23 },
  { team:teams[1], position:2, played:10, wins:7, draws:2, losses:1, difference:14, points:23 },
  { team:teams[2], position:3, played:10, wins:7, draws:1, losses:2, difference:9, points:22 },
  { team:teams[3], position:4, played:10, wins:7, draws:1, losses:2, difference:6, points:22 },
  { team:teams[4], position:5, played:10, wins:6, draws:2, losses:2, difference:9, points:20 },
  { team:teams[5], position:6, played:10, wins:5, draws:3, losses:2, difference:3, points:18 },
  { team:teams[6], position:7, played:10, wins:5, draws:2, losses:3, difference:5, points:17 },
];
export const matches = [
  { id:'j11-a', home:teams[2], away:teams[5], roundLabel:'Jornada 11', dateLabel:'Sáb., 16 jan.', timeLabel:'15:00', venue:'Campo da Aurora', state:'provisional', score:{home:0,away:0} },
  { id:'j11-b', home:teams[8], away:teams[6], roundLabel:'Jornada 11', dateLabel:'Sáb., 16 jan.', timeLabel:'15:00', venue:'Campo da Brisa', state:'provisional', score:{home:2,away:1} },
  { id:'j11-c', home:teams[9], away:teams[7], roundLabel:'Jornada 11', dateLabel:'Sáb., 16 jan.', timeLabel:'17:00', venue:'Campo da Casa do Povo', state:'scheduled' },
  { id:'j11-d', home:teams[0], away:teams[4], roundLabel:'Jornada 11', dateLabel:'Dom., 17 jan.', timeLabel:'10:30', venue:'Campo da Operária', state:'scheduled' },
  { id:'j10-a', home:teams[0], away:teams[6], roundLabel:'Jornada 10', dateLabel:'Qua., 13 jan.', timeLabel:'20:30', venue:'Campo da Operária', state:'official', score:{home:3,away:0} },
];
export const finalMatch = {
  id:'final', home:teams[8], away:teams[1], roundLabel:'Final · Taça Piloto', dateLabel:'22 mai.', timeLabel:'17:00',
  venue:'Estádio Municipal', state:'official', score:{home:1,away:1}, shootout:{home:3,away:4}, winnerTeamId:'mare',
};
export const players = [
  { id:'ivo', name:'Ivo Ramos', teamName:'Núcleo Desportivo Brisa', value:9 },
  { id:'orlando', name:'Orlando Costa', teamName:'Desportivo Maré Alta', value:7 },
  { id:'miguel', name:'Miguel Ribeiro', teamName:'Grupo Desportivo Ribeirinho', value:7 },
];
export const post = {
  id:'jornada', category:'Pela liga', date:'2027-01-14', dateLabel:'14 de janeiro',
  visualLabel:'FIM DE SEMANA. FUTEBOL DE SEMPRE.', title:'Dez jogos. Vinte equipas. O próximo capítulo.',
  excerpt:'Os encontros, os horários e as histórias da próxima jornada do futebol popular.',
};
