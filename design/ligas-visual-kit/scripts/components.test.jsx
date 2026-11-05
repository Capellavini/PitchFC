import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PitchSurface, PitchButton, Scoreboard, StandingsTable, FormField, LeaguePostCard } from '../components/index.jsx';
import { matches, finalMatch, standings } from '../preview/demo-data.mjs';
import { createLeaguePalette, contrastRatio } from '../pitch-tokens.mjs';

test('zero scores remain visible and shootouts stay separate from the match result', () => {
  const zero = renderToStaticMarkup(<Scoreboard {...matches[0]} />);
  assert.match(zero, /Resultado: 0 a 0/);
  assert.doesNotMatch(zero, /Por marcar/);
  const final = renderToStaticMarkup(<Scoreboard {...finalMatch} />);
  assert.match(final, /Resultado: 1 a 1/);
  assert.match(final, /Penáltis <b>3–4<\/b>/);
  assert.match(final, /Vencedor: <b>Desportivo Maré Alta<\/b>/);
});

test('official winner is not invented when the caller has not supplied one', () => {
  const { winnerTeamId, ...undecided } = finalMatch;
  const markup = renderToStaticMarkup(<Scoreboard {...undecided} />);
  assert.doesNotMatch(markup, /Vencedor:/);
});

test('standings preserve full team names, row headings and supplied points', () => {
  const markup = renderToStaticMarkup(<StandingsTable rows={standings} />);
  assert.match(markup, /Grupo Desportivo Ribeirinho/);
  assert.match(markup, /scope="row"/);
  assert.match(markup, /pl-table-points">23<\/td>/);
});

test('form fields connect label, hint and error to their generated input ID', () => {
  const markup = renderToStaticMarkup(<FormField label="E-mail" hint="Usado para entrar" error="E-mail inválido" />);
  const id = markup.match(/<input\b[^>]*?\sid="([^"]+)"/)[1];
  assert.ok(markup.includes(`for="${id}"`));
  assert.ok(markup.includes(`aria-describedby="${id}-hint ${id}-error"`));
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /role="alert"/);
});

test('pending action cannot be submitted twice through its button', () => {
  const markup = renderToStaticMarkup(<PitchButton loading>Guardar</PitchButton>);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /type="button"/);
});

test('light tenant colours remain readable and do not leak into app styling', () => {
  for (const color of ['#FFFF00','#FFFFFF','#111111','#355BC4','#FF99BB','#777777']) {
    const palette = createLeaguePalette(color);
    assert.ok(contrastRatio(palette['--pitch-league-primary'], palette['--pitch-league-on-primary']) >= 4.5);
    assert.ok(contrastRatio(palette['--pitch-league-link'], '#FFFFFF') >= 4.5);
    assert.ok(contrastRatio(palette['--pitch-league-deep'], '#FFFFFF') >= 4.5);
    assert.ok(contrastRatio(palette['--pitch-league-deep'], '#CBD6E7') >= 4.5);
  }
  const app = renderToStaticMarkup(<PitchSurface appearance="app" leagueColor="#FFFF00">App</PitchSurface>);
  assert.doesNotMatch(app, /--pitch-league-primary/);
});

test('editorial text is escaped rather than injected as executable markup', () => {
  const markup = renderToStaticMarkup(<LeaguePostCard post={{title:'<script>alert(1)</script>',category:'Aviso',date:'2026-11-04',dateLabel:'4 nov.',excerpt:'<img src=x onerror=alert(1)>'}} />);
  assert.ok(markup.includes('&lt;script&gt;'));
  assert.doesNotMatch(markup, /<script>|<img src=x/);
});
