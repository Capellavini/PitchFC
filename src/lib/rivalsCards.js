// ── PITCH Rivals share cards (canvas → PNG) ─────────────────
// Two cards, same visual language as postMatchCard.js / teamsCard.js (navy,
// lime, italic 900 numbers): the CONFIRMED result of a match and a team's
// stats card. Pure canvas, no server. What each card shows is decided by
// rivalsCardData.js (confirmed data only); this file only translates and
// draws. The palette is deliberately fixed (not the app theme): a card that
// gets shared must look the same whatever mode the sender uses.

import { ini } from "./helpers";
import { inkOn } from "../theme";
import { getLang, t } from "./i18n";
import { RC, RIVALS_BRAND, tf } from "./rivalsCopy";
import { MC } from "./rivalsMatchCopy";
import { SC, milestoneLabel } from "./rivalsShareCopy";
import { formatKickoff } from "./rivals";
import { drawBallIcon, fitFont, loadImage, roundRect } from "./postMatchCard";

const W = 720;
const PAD = 44;
const TOP = 130;
const FONT = "-apple-system, 'Segoe UI', Roboto, sans-serif";
const LOCALE = { pt: "pt-PT", "pt-br": "pt-BR", en: "en-GB" };
// Brand navy + accents (src/theme.js DARK), frozen for the images.
const K = {
  bg: "#0A0F18", surface: "#121A27", card: "#1A2433", border: "#262E3D",
  accent: "#C8FF00", text1: "#FFFFFF", text2: "#8A94A8", text3: "#3D4659",
  green: "#00D08A", orange: "#FF9F0A", red: "#FF3B5C",
};
const OUTCOME = { W: [K.green, RC.winShort], D: [K.orange, RC.drawShort], L: [K.red, RC.lossShort] };

const optionalImage = (src) => (src ? loadImage(src).catch(() => null) : Promise.resolve(null));
const hexA = (hex, a) => (/^#[0-9a-f]{6}$/i.test(hex || "") ? `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : `rgba(200,255,0,${a})`);
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const measureCtx = () => document.createElement("canvas").getContext("2d");

function startCanvas(h) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = K.bg;
  ctx.fillRect(0, 0, W, h);
  return { canvas, ctx };
}

function drawHeader(ctx, logo, kicker) {
  ctx.textBaseline = "top"; ctx.textAlign = "left";
  if (logo) {
    const h = 40;
    const w = h * (logo.width / logo.height);
    ctx.drawImage(logo, W - PAD - w, PAD, w, h);
  }
  ctx.fillStyle = K.accent;
  ctx.font = `italic 900 24px ${FONT}`;
  ctx.fillText(RIVALS_BRAND.toUpperCase(), PAD, PAD);
  ctx.fillStyle = K.text2;
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText(kicker, PAD, PAD + 32);
}

function drawFooter(ctx, h, note) {
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  if (note) { ctx.fillStyle = K.text2; ctx.font = `600 18px ${FONT}`; ctx.fillText(note, W / 2, h - 84); }
  ctx.fillStyle = K.text3;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("pitch-fc.com", W / 2, h - 52);
}

/** A team crest at (x, y): the uploaded badge or initials on the kit colour. */
function drawBadge(ctx, team, img, x, y, size) {
  const color = team.color || K.accent;
  ctx.save();
  roundRect(ctx, x, y, size, size, size * 0.32);
  ctx.clip();
  if (img) {
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, x, y, size, size);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
  roundRect(ctx, x, y, size, size, size * 0.32);
  ctx.lineWidth = Math.max(3, size * 0.045);
  ctx.strokeStyle = team.secondaryColor || K.border;
  ctx.stroke();
  if (!img) {
    ctx.fillStyle = inkOn(color);
    ctx.font = `italic 900 ${Math.round(size * 0.34)}px ${FONT}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ini(team.name || "?"), x + size / 2, y + size / 2 + 2);
  }
}

// ── Confirmed result ────────────────────────────────────────
/** d = rivalsCardData.resultCardData() → PNG data URL. */
export async function renderResultCard(d) {
  const locale = LOCALE[getLang()] || "pt-PT";
  const [logo, homeImg, awayImg] = await Promise.all([optionalImage("/brand/logo.png"), optionalImage(d.home.logoUrl), optionalImage(d.away.logoUrl)]);

  const rowsOf = (s) => s.list.length + (s.more ? 1 : 0);
  const rows = Math.max(rowsOf(d.scorers.home), rowsOf(d.scorers.away));
  const heroH = 300;
  const infoH = 110;
  const chipH = d.confrontoN ? 64 : 0;
  const scorersH = rows ? 60 + rows * 44 + 16 : 0;
  const H = TOP + heroH + infoH + chipH + scorersH + 110;
  const { canvas, ctx } = startCanvas(H);

  // Each half washes in its own team colour.
  for (const [x, color] of [[0, d.home.color], [W / 2, d.away.color]]) {
    const g = ctx.createLinearGradient(0, 0, 0, TOP + heroH);
    g.addColorStop(0, hexA(color, 0.28));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, W / 2, TOP + heroH);
  }
  drawHeader(ctx, logo, t(SC.cardConfirmed));

  // badges · score · names
  const size = 140;
  const cxL = PAD + 96;
  const cxR = W - PAD - 96;
  const by = TOP + 10;
  drawBadge(ctx, d.home, homeImg, cxL - size / 2, by, size);
  drawBadge(ctx, d.away, awayImg, cxR - size / 2, by, size);

  const scoreY = by + size / 2;
  const scoreFont = (txt) => `italic 900 ${fitFont(ctx, txt, 130, { startPx: 124, minPx: 60, weight: "italic 900", family: FONT })}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillStyle = d.winner === "home" ? K.accent : K.text1;
  ctx.font = scoreFont(String(d.homeScore));
  ctx.fillText(String(d.homeScore), W / 2 - 38, scoreY);
  ctx.textAlign = "left";
  ctx.fillStyle = d.winner === "away" ? K.accent : K.text1;
  ctx.font = scoreFont(String(d.awayScore));
  ctx.fillText(String(d.awayScore), W / 2 + 38, scoreY);
  ctx.textAlign = "center";
  ctx.fillStyle = K.text2;
  ctx.font = `900 56px ${FONT}`;
  ctx.fillText("–", W / 2, scoreY - 4);

  for (const [team, cx] of [[d.home, cxL], [d.away, cxR]]) {
    const name = team.name.toUpperCase();
    const px = fitFont(ctx, name, 230, { startPx: 30, minPx: 16, weight: "italic 900", family: FONT });
    ctx.font = `italic 900 ${px}px ${FONT}`;
    ctx.fillStyle = K.text1;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(name, cx, by + size + 22);
    ctx.fillStyle = team.color || K.accent;
    roundRect(ctx, cx - 30, by + size + 22 + px + 12, 60, 5, 2.5);
    ctx.fill();
  }

  // when · where
  let y = TOP + heroH;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillStyle = K.text1;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(formatKickoff(d.kickoffAt, { timezone: d.timezone, locale }), W / 2, y + 12);
  const where = [d.venue, d.format].filter(Boolean).join("  ·  ");
  if (where) {
    ctx.fillStyle = K.text2;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText(where, W / 2, y + 54);
  }
  y += infoH;

  if (d.confrontoN) {
    const txt = tf(MC.h2hTitle, { n: d.confrontoN });
    ctx.font = `800 18px ${FONT}`;
    const w = ctx.measureText(txt).width + 44;
    roundRect(ctx, (W - w) / 2, y, w, 40, 20);
    ctx.lineWidth = 2; ctx.strokeStyle = K.accent; ctx.stroke();
    ctx.fillStyle = K.accent;
    ctx.textBaseline = "middle";
    ctx.fillText(txt, W / 2, y + 21);
    y += chipH;
  }

  if (rows) {
    ctx.fillStyle = K.border;
    ctx.fillRect(PAD, y, W - PAD * 2, 1);
    ctx.fillStyle = K.text2;
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(t(SC.cardScorers), W / 2, y + 20);
    for (const [s, x] of [[d.scorers.home, PAD + 8], [d.scorers.away, W / 2 + 28]]) {
      const lines = [...s.list.map((p) => ({ p })), ...(s.more ? [{ more: s.more }] : [])];
      lines.forEach((ln, i) => {
        const cy = y + 60 + i * 44 + 20;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        if (ln.p) {
          drawBallIcon(ctx, x + 12, cy, 11, K.accent);
          ctx.fillStyle = K.text1;
          ctx.font = `700 24px ${FONT}`;
          ctx.fillText(ln.p.nick, x + 36, cy);
          if (ln.p.goals > 1) {
            const nw = ctx.measureText(ln.p.nick).width;
            ctx.fillStyle = K.text2;
            ctx.fillText(`×${ln.p.goals}`, x + 36 + nw + 10, cy);
          }
        } else {
          ctx.fillStyle = K.text2;
          ctx.font = `700 20px ${FONT}`;
          ctx.fillText(tf(SC.cardMore, { n: ln.more }), x + 36, cy);
        }
      });
    }
  }

  drawFooter(ctx, H, t(SC.cardBothTeams));
  return canvas.toDataURL("image/png");
}

// ── Team stats card ─────────────────────────────────────────
function drawStatTile(ctx, x, y, w, h, value, label, color) {
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = K.surface; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = K.border; ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  const px = fitFont(ctx, String(value), w - 20, { startPx: 54, minPx: 26, weight: "italic 900", family: FONT });
  ctx.font = `italic 900 ${px}px ${FONT}`;
  ctx.fillText(String(value), x + w / 2, y + h * 0.42);
  ctx.fillStyle = K.text2;
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h - 22);
}

/** d = rivalsCardData.teamCardData() → PNG data URL. */
export async function renderTeamCard(d) {
  const [logo, teamImg] = await Promise.all([optionalImage("/brand/logo.png"), optionalImage(d.team.logoUrl)]);
  const gap = 12;

  // Milestone pills wrap onto lines — measure them before sizing the image.
  const mctx = measureCtx();
  mctx.font = `800 20px ${FONT}`;
  const pills = d.milestones.map((m) => ({ text: milestoneLabel(m), w: 0 }));
  pills.forEach((p) => { p.w = mctx.measureText(p.text).width + 36; });
  const pillLines = [];
  let cur = [];
  let curW = 0;
  for (const p of pills) {
    if (cur.length && curW + gap + p.w > W - PAD * 2) { pillLines.push(cur); cur = []; curW = 0; }
    cur.push(p); curW += (cur.length > 1 ? gap : 0) + p.w;
  }
  if (cur.length) pillLines.push(cur);

  const listRows = Math.max(d.scorers.length, d.assisters.length);
  const idH = 150;
  const bodyH = d.played
    ? 150 + 16 + 100 + 16 + 100 + 16 + (listRows ? 44 + listRows * 40 + 16 : 0) + (pillLines.length ? 44 + pillLines.length * 52 + 8 : 0)
    : 130;
  const H = TOP + idH + bodyH + 100;
  const { canvas, ctx } = startCanvas(H);

  const color = d.team.color || K.accent;
  const g = ctx.createLinearGradient(0, 0, 0, TOP + idH);
  g.addColorStop(0, hexA(color, 0.28));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, TOP + idH);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, 10);
  drawHeader(ctx, logo, t(SC.cardTeamKicker));

  // identity
  let y = TOP;
  drawBadge(ctx, d.team, teamImg, PAD, y, 120);
  const nx = PAD + 144;
  const name = d.team.name.toUpperCase();
  const px = fitFont(ctx, name, W - PAD - nx, { startPx: 46, minPx: 24, weight: "italic 900", family: FONT });
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = K.text1;
  ctx.font = `italic 900 ${px}px ${FONT}`;
  ctx.fillText(name, nx, y + 12);
  const sub = [d.team.city, d.team.format, d.memberCount ? (d.memberCount === 1 ? t(RC.playersOne) : tf(RC.playersN, { n: d.memberCount })) : null].filter(Boolean).join("  ·  ");
  ctx.fillStyle = K.text2;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(sub, nx, y + 12 + px + 14);
  y += idH;

  if (!d.played) {
    roundRect(ctx, PAD, y, W - PAD * 2, 100, 18);
    ctx.fillStyle = K.surface; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = K.border; ctx.stroke();
    ctx.fillStyle = K.text2;
    ctx.font = `700 22px ${FONT}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(t(SC.cardNoGames), W / 2, y + 50);
    drawFooter(ctx, H, null);
    return canvas.toDataURL("image/png");
  }

  const r = d.record;
  // played · W · D · L
  const colW = (W - PAD * 2 - gap * 3) / 4;
  [[r.played, RC.played, K.text1], [r.wins, RC.wins, K.green], [r.draws, RC.draws, K.orange], [r.losses, RC.losses, K.red]]
    .forEach(([v, label, c], i) => drawStatTile(ctx, PAD + i * (colW + gap), y, colW, 150, v, t(label), c));
  y += 150 + 16;
  // goals · diff · streak · clean sheets
  const streak = r.streak?.type ? `${r.streak.n}${t(OUTCOME[r.streak.type][1])}` : "—";
  [[`${r.goalsFor}–${r.goalsAgainst}`, MC.tileGoals], [signed(r.goalDiff), MC.tileDiff], [streak, MC.tileStreak], [r.cleanSheets, MC.tileClean]]
    .forEach(([v, label], i) => drawStatTile(ctx, PAD + i * (colW + gap), y, colW, 100, v, t(label), K.text1));
  y += 100 + 16;

  // form
  roundRect(ctx, PAD, y, W - PAD * 2, 100, 16);
  ctx.fillStyle = K.surface; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = K.border; ctx.stroke();
  ctx.fillStyle = K.text2;
  ctx.font = `700 14px ${FONT}`;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(t(MC.formLabel).toUpperCase(), PAD + 22, y + 16);
  r.form.forEach((o, i) => {
    const cx = PAD + 22 + 22 + i * 56;
    const cy = y + 66;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = OUTCOME[o][0]; ctx.fill();
    ctx.fillStyle = K.bg;
    ctx.font = `900 20px ${FONT}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(t(OUTCOME[o][1]), cx, cy + 1);
  });
  y += 100 + 16;

  // top scorers · top assisters
  if (listRows) {
    ctx.fillStyle = K.border;
    ctx.fillRect(PAD, y, W - PAD * 2, 1);
    [[d.scorers, SC.cardScorers, PAD + 4], [d.assisters, SC.cardAssisters, W / 2 + 20]].forEach(([list, label, x]) => {
      if (!list.length) return;
      ctx.fillStyle = K.text2;
      ctx.font = `700 14px ${FONT}`;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(t(label), x, y + 18);
      list.forEach((p, i) => {
        const cy = y + 44 + i * 40 + 20;
        ctx.textBaseline = "middle";
        ctx.fillStyle = K.text1;
        ctx.font = `700 24px ${FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(p.nick, x, cy);
        ctx.fillStyle = K.accent;
        ctx.font = `italic 900 26px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(String(p.n), x + (W / 2 - PAD - 28), cy);
      });
    });
    y += 44 + listRows * 40 + 16;
  }

  // milestones
  if (pillLines.length) {
    ctx.fillStyle = K.text2;
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(t(SC.cardMilestones), PAD + 4, y + 8);
    pillLines.forEach((line, li) => {
      let x = PAD;
      const py = y + 40 + li * 52;
      line.forEach((p) => {
        roundRect(ctx, x, py, p.w, 40, 20);
        ctx.fillStyle = hexA(K.accent, 0.12); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = K.accent; ctx.stroke();
        ctx.fillStyle = K.accent;
        ctx.font = `800 20px ${FONT}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(p.text, x + p.w / 2, py + 21);
        x += p.w + gap;
      });
    });
  }

  drawFooter(ctx, H, null);
  return canvas.toDataURL("image/png");
}
