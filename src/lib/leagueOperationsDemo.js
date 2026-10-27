const names=['Miguel Costa','Rafael Neves','João Silva','Tomás Reis','André Lopes','Pedro Alves','Diogo Santos','Tiago Sousa'];
export function operationsDemoSeed(){
 const clubs=['PITCH FC','Costa Verde','União do Norte','Estrela do Mar'];
 const teams=clubs.map((name,i)=>({registrationId:`r${i}`,team:{id:`t${i}`,name},squad:names.map((n,j)=>({playerId:`p${i}-${j}`,name:i===0?n:`${n.split(' ')[0]} ${['Pinto','Rocha','Matos','Lima'][i]}`,shirtNumber:j+1,position:j===0?'Guarda-redes':j<3?'Defesa':j<6?'Médio':'Avançado'}))}));
 const create=(id,h,a,round,kickoff,state,hs=null,as=null,venue='CCD Porto · Campo 1')=>({id,homeId:`t${h}`,awayId:`t${a}`,home:teams[h].team,away:teams[a].team,round,roundName:`Jornada ${round}`,kickoff,timezone:'Europe/Lisbon',state,homeScore:hs,awayScore:as,venue,seq:1,officials:[]});
 return {league:{id:'demo-liga',name:'Associação · Demonstração',slug:'liga-exemplo',description:'O futebol da região. Os clubes, os atletas e cada jornada, no mesmo lugar.',myRoles:['owner'],competitions:[{id:'demo-competition',slug:'liga-futebol-7',name:'Liga de Futebol 7',season:'2026/27'}]},
 competition:{id:'demo-competition',name:'Liga de Futebol 7',slug:'liga-futebol-7',league:{slug:'liga-exemplo',name:'Associação · Demonstração'},season:'2026/27',category:'Seniores',format:'F7',matchDurationMin:60,isStaff:true},teams,
 matches:[create('m1',0,1,1,'2026-11-29T10:00:00Z','homologated',3,1),create('m2',2,3,1,'2026-11-29T11:30:00Z','homologated',2,2),create('m3',0,2,2,'2026-12-06T10:00:00Z','in_review',2,1),create('m4',1,3,2,'2026-12-06T11:30:00Z','ended_provisional',0,1),create('m5',0,3,3,'2026-12-13T10:00:00Z','scheduled'),create('m6',1,2,3,'2026-12-13T10:30:00Z','scheduled')],
 stats:teams.flatMap((t,i)=>t.squad.map((p,j)=>({playerId:p.playerId,teamId:t.team.id,apps:1,goals:j===3?i+1:0,assists:j===5?1:0,yellows:0,reds:0}))),error:null};
}
