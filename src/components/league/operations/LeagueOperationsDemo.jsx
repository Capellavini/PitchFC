import {useState} from 'react';
import {operationsDemoSeed} from '../../../lib/leagueOperationsDemo';
import {demoLiveTransition,demoLiveEvent} from '../../../lib/leagueLiveDemo';
import LeagueOperations from './LeagueOperations';
export default function LeagueOperationsDemo(){
 const [data,setData]=useState(operationsDemoSeed);
 const apply=fn=>setData(d=>{try{return fn(d)}catch{return d}});
 return <LeagueOperations {...data} demo onDemoTransition={(id,action)=>apply(d=>demoLiveTransition(d,id,action))} onDemoEvent={(id,e)=>apply(d=>demoLiveEvent(d,id,e))} onDemoSchedule={(id,patch)=>setData(d=>({...d,matches:d.matches.map(m=>m.id===id?{...m,...patch}:m)}))} onDemoDecision={id=>setData(d=>({...d,matches:d.matches.map(m=>m.id===id?{...m,state:'homologated',resultStatus:'homologated'}:m)}))}/>;
}
