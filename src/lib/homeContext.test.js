import test from 'node:test';
import assert from 'node:assert/strict';
import {homeContexts, resolveHomeContext, competitionTable, summarizeLeagueHome} from './homeContext.js';
const leagues=[{id:'l',roles:['owner']}], teams=[{id:'t'}];
test('entry follows actual memberships, with an explicit preference for people with multiple roles',()=>{
  assert.equal(resolveHomeContext(), 'player');
  assert.equal(resolveHomeContext({teams}), 'rivals');
  assert.equal(resolveHomeContext({leagues,teams}), 'league');
  assert.equal(resolveHomeContext({leagues,teams,preferred:'player'}), 'player');
  assert.equal(resolveHomeContext({leagues,teams,preferred:'rivals'}), 'rivals');
  assert.equal(resolveHomeContext({preferred:'league'}), 'player');
  assert.equal(resolveHomeContext({leagues:[{roles:[]}]}), 'player');
});
test('dedicated league presentation hides other contexts but never grants access',()=>{
  assert.deepEqual(homeContexts({leagues,teams,mode:'league_only'}),['league']);
  assert.equal(resolveHomeContext({leagues,teams,mode:'league_only',preferred:'rivals'}),'league');
  assert.deepEqual(homeContexts({teams,mode:'league_only'}),['player','rivals']);
});
test('table only counts homologated finished scores, using the published points and tiebreakers',()=>{
  const m=(result_status,home_score,away_score)=>({home:{id:'a'},away:{id:'b'},result_status,match_status:'finished',home_score,away_score});
  const table=competitionTable([{id:'a'},{id:'b'}],[m('homologated',2,1),m('submitted',9,0),m('homologated',null,null)],{points:{win:4,draw:2,loss:0},tiebreakers:['pts','gd','gf']});
  assert.equal(table[0].pts,4); assert.equal(table[0].gf,2); assert.equal(table[0].j,1);
});
test('league home counts unique teams and submitted squads, excludes past and cancelled games',()=>{
  const team={team:{id:'t'}};
  const c={teams:[team],registrations:{items:[{versions:[{status:'submitted'},{status:'homologated'}]}]},matches:[
    {id:'past',match_status:'scheduled',kickoff_at:'2026-10-20T12:00Z'},
    {id:'next',match_status:'scheduled',kickoff_at:'2026-10-25T12:00Z'},
    {id:'cancelled',match_status:'cancelled',kickoff_at:'2026-10-24T12:00Z'}]};
  const s=summarizeLeagueHome([c,{teams:[team]}],Date.parse('2026-10-23T12:00Z'));
  assert.equal(s.teams,1); assert.equal(s.competitions,2); assert.equal(s.pending,1); assert.deepEqual(s.upcoming.map(m=>m.id),['next']);
});
test('someone who belongs to a group opens as Player by default; a valid preference still wins',()=>{
  assert.equal(resolveHomeContext({teams,hasGroup:true}), 'player');
  assert.equal(resolveHomeContext({leagues,teams,hasGroup:true}), 'player');
  assert.equal(resolveHomeContext({leagues,hasGroup:true}), 'player');
  assert.equal(resolveHomeContext({leagues,teams,hasGroup:true,preferred:'rivals'}), 'rivals');
  assert.equal(resolveHomeContext({leagues,teams,hasGroup:true,preferred:'league'}), 'league');
  assert.equal(resolveHomeContext({teams,hasGroup:true,preferred:'league'}), 'player');
});
test('without a group the team / league space is still the entry, and league-only mode is untouched',()=>{
  assert.equal(resolveHomeContext({teams,hasGroup:false}), 'rivals');
  assert.equal(resolveHomeContext({leagues,teams,hasGroup:false}), 'league');
  assert.equal(resolveHomeContext({leagues,teams,mode:'league_only',hasGroup:true}), 'league');
});
