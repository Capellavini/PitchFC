import {isOfficial} from './leagueOperations.js';
export const officialGames=(matches=[])=>matches.filter(m=>isOfficial(m)&&Number.isInteger(m.homeScore)&&Number.isInteger(m.awayScore));
export function teamSummary(teamId,matches=[]){
 const rows=officialGames(matches).filter(m=>[m.homeId,m.awayId].includes(teamId));
 const calc=list=>list.reduce((s,m)=>{const home=m.homeId===teamId,gf=home?m.homeScore:m.awayScore,ga=home?m.awayScore:m.homeScore;return {...s,games:s.games+1,wins:s.wins+Number(gf>ga),draws:s.draws+Number(gf===ga),losses:s.losses+Number(gf<ga),goals:s.goals+gf,conceded:s.conceded+ga,cleanSheets:s.cleanSheets+Number(ga===0)}},{games:0,wins:0,draws:0,losses:0,goals:0,conceded:0,cleanSheets:0});
 const total=calc(rows),home=calc(rows.filter(m=>m.homeId===teamId)),away=calc(rows.filter(m=>m.awayId===teamId));
 const rate=s=>s.games?100*s.wins/s.games:null;
 return {...total,home,away,winRate:rate(total),homeRate:rate(home),awayRate:rate(away),homeAdvantage:home.games&&away.games?rate(home)-rate(away):null,form:[...rows].sort((a,b)=>String(a.kickoff||'').localeCompare(String(b.kickoff||''))).slice(-5).map(m=>{const gf=m.homeId===teamId?m.homeScore:m.awayScore,ga=m.homeId===teamId?m.awayScore:m.homeScore;return gf>ga?'V':gf===ga?'E':'D'})};
}
export function compareTeams(a,b,matches=[]){if(!a||!b||a===b)throw Error('Seleciona duas equipas diferentes.');const games=officialGames(matches).filter(m=>[m.homeId,m.awayId].includes(a)&&[m.homeId,m.awayId].includes(b));return {a:teamSummary(a,matches),b:teamSummary(b,matches),headToHead:{...teamSummary(a,games),matches:games}}}
export function playerSummary(id,stats=[]){const rows=stats.filter(s=>s.playerId===id);if(!rows.length)return null;const sum=k=>rows.every(r=>Number.isFinite(r[k]))?rows.reduce((n,r)=>n+r[k],0):null;return {apps:sum('apps'),goals:sum('goals'),assists:sum('assists'),yellows:sum('yellows'),reds:sum('reds')};}
export const localDay=(iso,zone='Europe/Lisbon')=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso))}catch{return null}};
export function calendarDays(anchor,view='month'){const d=new Date(anchor+'T12:00:00Z');if(!Number.isFinite(+d))return [];if(view==='month')d.setUTCDate(1);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return Array.from({length:view==='week'?7:42},(_,i)=>{const x=new Date(d);x.setUTCDate(d.getUTCDate()+i);return x.toISOString().slice(0,10)})}
