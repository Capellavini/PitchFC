import test from 'node:test';
import assert from 'node:assert/strict';
import { leagueIdentityFields, safeLeagueLogo, leagueMonogram } from './leaguePresentation.js';
import { emptyLeagueOrgState, leagueDemoOp, normLeaguePage } from './leagueCloud.js';

test('identity editing cannot publish or grant access through extra input fields', () => {
  const result = leagueIdentityFields({ name: '  Liga Porto  ', color: '#12ab34', visibility: 'public', myRoles: ['owner'], slug: 'changed' });
  assert.deepEqual(result.data, { name: 'Liga Porto', short_name: null, description: null, logo_url: null, color: '#12AB34' });
});
test('public badge rejects executable/local/credential URLs and validates identity bounds', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,test', 'file:///C:/secret', 'http://example.com/logo.png', 'https://user:pass@example.com/logo.png']) {
    assert.equal(safeLeagueLogo(url), null);
    assert.equal(leagueIdentityFields({ name: 'Porto', color: '#123456', logoUrl: url }).error, 'logoUrl');
  }
  assert.equal(safeLeagueLogo('https://example.com/logo.png'), 'https://example.com/logo.png');
  assert.equal(leagueIdentityFields({ name: 'P', color: '#123456' }).error, 'name');
  assert.equal(leagueIdentityFields({ name: 'Porto', shortName: 'a'.repeat(25), color: '#123456' }).error, 'shortName');
  assert.equal(leagueIdentityFields({ name: 'Porto', description: 'a'.repeat(2001), color: '#123456' }).error, 'description');
  assert.equal(leagueIdentityFields({ name: 'Porto', color: 'red' }).error, 'color');
  assert.equal(leagueMonogram('  Liga do Porto '), 'LDP');
});
test('demo identity survives save and public projection without changing its private state', () => {
  const actor = { id: 'owner', name: 'Owner', isAdmin: true };
  let step = leagueDemoOp(emptyLeagueOrgState(), 'create_league', { name: 'Porto' }, actor);
  const id = step.data.leagueId, slug = step.data.slug;
  const fields = leagueIdentityFields({ name: 'Liga Porto', shortName: 'LDP', color: '#123456', description: 'A liga local.', logoUrl: 'https://example.com/crest.png' }).data;
  step = leagueDemoOp(step.state, 'update_league', { leagueId: id, fields }, actor);
  const page = leagueDemoOp(step.state, 'league_page', { slug }, actor);
  const projected = normLeaguePage(page.data);
  assert.equal(projected.shortName, 'LDP');
  assert.equal(projected.description, 'A liga local.');
  assert.equal(projected.logoUrl, 'https://example.com/crest.png');
  assert.equal(projected.visibility, 'private');
  assert.equal(projected.status, 'draft');
  assert.equal(leagueDemoOp(step.state, 'league_page', { slug }, null).data, null);
});
