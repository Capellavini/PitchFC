import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFeed, normalizeMatchdays, goalOfTheWeekRanking } from './homeFeed.js';

const now = Date.parse('2026-10-14T12:00:00Z');
const md = (id, ts = now) => ({ id, ts, groupName: 'Quarta', dateLabel: '14 Out', mvpKey: 'me', summary: {
  matches: [{ n: 1, homeName: 'A', awayName: 'B', homeGoals: 4, awayGoals: 2 }, { n: 2, homeName: 'A', awayName: 'B', homeGoals: 1, awayGoals: 0 }],
  lines: [{ key: 'me', nick: 'Vini', goals: 4, assists: 1 }, { key: 'other', nick: 'Lukas', goals: 3, assists: 0 }],
} });

test('one session creates one summary, with MVP, performances and all match details inside', () => {
  const input = md('one');
  const items = buildFeed({ matchdays: [input, input], myKey: 'me', streak: 4 });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'summary');
  assert.equal(items[0].md.summary.matches.length, 2);
  assert.equal(items[0].highlights.length, 2);
  assert.equal(items[0].highlights[0].isMvp, true);
  assert.equal(items[0].streak, 4);
  assert.equal(input.kind, undefined);
});
test('conquests and legend are nested in the summary instead of separate posts', () => {
  const days = [md('a')];
  const players = [{ id: 'me', nick: 'Vini', goals: 4, assists: 1, gamesPlayed: 1, mvps: 1, isMe: true }];
  const items = buildFeed({ matchdays: days, players, myKey: 'me', activeGroupName: 'Quarta' });
  assert.equal(items.length, 1);
  assert.ok(items[0].achievements.length > 0);
});
test('same-date sessions from different groups remain distinct', () => {
  const items = buildFeed({ matchdays: [md('a'), { ...md('b'), groupName: 'Domingo' }], myKey: 'me' });
  assert.equal(items.length, 2);
  assert.deepEqual(new Set(items.map(i => i.md.groupName)), new Set(['Quarta', 'Domingo']));
});
test('record and streak stay on the latest session actually played by the user', () => {
  const a = md('a');
  const b = md('b', now - 86400000); b.summary.lines[0].goals = 1;
  const c = md('c', now - 172800000); c.summary.lines[0].goals = 1;
  const unrelated = md('d', now + 1); unrelated.summary.lines = []; unrelated.mvpKey = null;
  const items = buildFeed({ matchdays: [b, c, unrelated, a], myKey: 'me', streak: 3 });
  assert.equal(items.find(i => i.md.id === 'd').streak, 0);
  assert.equal(items.find(i => i.md.id === 'a').streak, 3);
  assert.equal(items.find(i => i.md.id === 'a').highlights[0].isRecord, true);
});
test('weekly video replaces its own post once and unrelated posts retain the audience filter', () => {
  const posts = [
    { id: 'v', type: 'video', media: '/goal.mp4', createdAt: new Date(now).toISOString(), likes: ['me'], author: { id: 'p', groupId: 'g' } },
    { id: 'hidden', author: { id: 'stranger', groupId: 'other' } },
    { id: 'own', mine: true, type: 'text', text: 'Great game' },
  ];
  const items = buildFeed({ posts: [...posts, posts[0]], myGroupIds: ['g'], gotwLeaderId: 'v', now });
  assert.equal(items.length, 2);
  assert.equal(items.filter(i => i.kind === 'gotw').length, 1);
  assert.ok(items.some(i => i.post.id === 'own'));
  assert.ok(!items.some(i => i.post.id === 'hidden'));
});
test('old or unvoted video cannot be highlighted as the current weekly leader', () => {
  for (const post of [
    { id: 'v', type: 'video', media: '/goal.mp4', mine: true, createdAt: new Date(now - 8*86400000).toISOString(), likes: ['me'] },
    { id: 'v', type: 'video', media: '/goal.mp4', mine: true, createdAt: new Date(now).toISOString(), likes: [] },
  ]) assert.equal(buildFeed({ posts: [post], gotwLeaderId: 'v', now })[0].kind, 'post');
});
test('cloud and local data normalize into the same one-summary model', () => {
  const cloud = normalizeMatchdays({ cloudRows: [{ id: 'c', created_at: new Date(now).toISOString(), played_on: '2026-10-14', groupName: 'Quarta', summary: md('x').summary }], fmt: () => '14 Out' });
  const local = normalizeMatchdays({ local: { days: [{ id: 'l', playedOn: '2026-10-14', date: '14 Out', summary: md('x').summary }], groupName: 'Quarta' } });
  for (const matchdays of [cloud, local]) assert.equal(buildFeed({ matchdays })[0].kind, 'summary');
});
