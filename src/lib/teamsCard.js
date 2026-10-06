// ── Teams share card (drawn teams → PNG) ────────────────────
// What organizers screenshot and post in the WhatsApp group once the
// teams are set: one block per team (name, captain, average OVR) with
// every player's photo, nick, position and OVR. Pure canvas, no server —
// same visual language as the post-match card (navy, lime, italic 900).

import { ini, computeOverall, POSITION_ABBR } from "./helpers";
import { POSITIONS } from "./core/overall.js";
import { loadImage, roundRect, fitFont } from "./postMatchCard";

const W = 720;
const PAD = 40;
const GAP = 20;
const COLS = 2;
const FONT = "-apple-system, 'Segoe UI', Roboto, sans-serif";
const ROW_H = 68;
const HEAD_H = 118;
const AVATAR_R = 24;

const posRank = (p) => { const i = POSITIONS.indexOf(p.position); return i < 0 ? POSITIONS.length : i; };

/** Goalkeeper → defenders → midfielders → forwards, best OVR first. */
function sortedRoster(players) {
  return players
    .map((p) => ({ p, ovr: computeOverall(p.position, p.attrs) }))
    .sort((a, b) => posRank(a.p) - posRank(b.p) || b.ovr - a.ovr);
}

/** teams: [{ id, name, color, players: [id], captainId? }]
 *  group: roster ({ id, name, nick, photo, position, attrs })
 *  meta: { groupName, dateLabel, timeLabel, venue }
 *  colorOf(player) → avatar fallback colour. */
export async function renderTeamsCard({ teams, group, meta = {}, colorOf = () => "#8A94A8" }) {
  const byId = new Map(group.map((p) => [p.id, p]));
  const blocks = teams.map((tm) => {
    const roster = sortedRoster((tm.players || []).map((id) => byId.get(id)).filter(Boolean));
    const avg = roster.length ? Math.round(roster.reduce((s, r) => s + r.ovr, 0) / roster.length) : null;
    const captain = tm.captainId != null ? byId.get(tm.captainId) : null;
    return { tm, roster, avg, captain };
  });

  const cellW = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const rowsOfTeams = Math.ceil(blocks.length / COLS);
  const rowHeights = Array.from({ length: rowsOfTeams }, (_, r) => {
    const most = Math.max(...blocks.slice(r * COLS, r * COLS + COLS).map((b) => b.roster.length), 1);
    return HEAD_H + most * ROW_H + 18;
  });

  const topH = 190;
  const footH = 84;
  const H = topH + rowHeights.reduce((s, h) => s + h, 0) + GAP * (rowsOfTeams - 1) + footH;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0A0F18";
  ctx.fillRect(0, 0, W, H);

  // Photos are optional — a failed/blocked load falls back to initials.
  const photoOf = new Map();
  const [logo] = await Promise.all([
    loadImage("/brand/logo.png").catch(() => null),
    ...blocks.flatMap((b) => b.roster.map(async ({ p }) => {
      if (p.photo) photoOf.set(p.id, await loadImage(p.photo).catch(() => null));
    })),
  ]);

  // ── header ──
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  if (logo) {
    const logoH = 44;
    ctx.drawImage(logo, W - PAD - logoH * (logo.width / logo.height), PAD, logoH * (logo.width / logo.height), logoH);
  }
  ctx.fillStyle = "#C8FF00";
  ctx.font = `900 18px ${FONT}`;
  ctx.fillText("EQUIPAS PRONTAS", PAD, PAD + 4);
  ctx.fillStyle = "#FFFFFF";
  const titlePx = fitFont(ctx, meta.groupName || "PITCH", W - PAD * 2 - 160, { startPx: 50, minPx: 28, weight: "italic 900", family: FONT });
  ctx.font = `italic 900 ${titlePx}px ${FONT}`;
  ctx.fillText((meta.groupName || "PITCH").toUpperCase(), PAD, PAD + 34);
  const when = [meta.dateLabel, meta.timeLabel].filter(Boolean).join(" · ");
  ctx.fillStyle = "#8A94A8";
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText([when, meta.venue].filter(Boolean).join("  ·  "), PAD, PAD + 34 + titlePx + 12);

  // ── team blocks ──
  let y = topH;
  rowHeights.forEach((rh, r) => {
    blocks.slice(r * COLS, r * COLS + COLS).forEach((b, c) => {
      const x = PAD + c * (cellW + GAP);
      drawTeam(ctx, b, x, y, cellW, rh, photoOf, colorOf);
    });
    y += rh + GAP;
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#3D4659";
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("pitch-fc.com", W / 2, H - 52);

  return canvas.toDataURL("image/png");
}

function drawTeam(ctx, { tm, roster, avg, captain }, x, y, w, h, photoOf, colorOf) {
  const color = tm.color || "#C8FF00";
  roundRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = "#121A27"; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = "#262E3D"; ctx.stroke();

  // team colour bar across the top
  ctx.save();
  roundRect(ctx, x, y, w, h, 20); ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 8);
  ctx.restore();

  // name, captain, average OVR
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = "#FFFFFF";
  const npx = fitFont(ctx, tm.name.toUpperCase(), w - 36 - 86, { startPx: 34, minPx: 20, weight: "italic 900", family: FONT });
  ctx.font = `italic 900 ${npx}px ${FONT}`;
  ctx.fillText(tm.name.toUpperCase(), x + 18, y + 26);
  ctx.fillStyle = "#8A94A8";
  ctx.font = `700 17px ${FONT}`;
  ctx.fillText(captain ? `Capitão ${captain.nick}` : `${roster.length} jogadores`, x + 18, y + 26 + npx + 8);

  if (avg != null) {
    const bw = 74, bh = 56, bx = x + w - 18 - bw, by = y + 24;
    roundRect(ctx, bx, by, bw, bh, 14);
    ctx.fillStyle = "#C8FF00"; ctx.fill();
    ctx.fillStyle = "#0A0F18";
    ctx.textAlign = "center";
    ctx.font = `italic 900 30px ${FONT}`;
    ctx.fillText(String(avg), bx + bw / 2, by + 5);
    ctx.font = `800 11px ${FONT}`;
    ctx.fillText("OVR MÉDIO", bx + bw / 2, by + 39);
  }

  // players
  roster.forEach(({ p, ovr }, i) => {
    const ry = y + HEAD_H + i * ROW_H;
    if (i > 0) { ctx.fillStyle = "#1A2433"; ctx.fillRect(x + 18, ry - 1, w - 36, 1); }
    const cx = x + 18 + AVATAR_R, cy = ry + ROW_H / 2;
    const photo = photoOf.get(p.id);

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, AVATAR_R, 0, Math.PI * 2); ctx.closePath();
    if (photo) {
      ctx.clip();
      // cover-crop to a square so non-square photos don't squash
      const s = Math.min(photo.width, photo.height);
      ctx.drawImage(photo, (photo.width - s) / 2, (photo.height - s) / 2, s, s, cx - AVATAR_R, cy - AVATAR_R, AVATAR_R * 2, AVATAR_R * 2);
    } else {
      ctx.fillStyle = `${colorOf(p)}33`; ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy, AVATAR_R, 0, Math.PI * 2); ctx.stroke();
    if (!photo) {
      ctx.fillStyle = colorOf(p);
      ctx.font = `900 19px ${FONT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(ini(p.name), cx, cy + 1);
    }

    // captain armband
    if (tm.captainId != null && p.id === tm.captainId) {
      ctx.beginPath(); ctx.arc(cx + AVATAR_R - 3, cy - AVATAR_R + 3, 11, 0, Math.PI * 2);
      ctx.fillStyle = "#E8C547"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#121A27"; ctx.stroke();
      ctx.fillStyle = "#0A0F18";
      ctx.font = `900 13px ${FONT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("C", cx + AVATAR_R - 3, cy - AVATAR_R + 4);
    }

    // nick + position
    const textX = cx + AVATAR_R + 14;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    const nickMax = w - 18 - (textX - x) - 56;
    const nx = fitFont(ctx, p.nick, nickMax, { startPx: 22, minPx: 14, weight: "800", family: FONT });
    ctx.font = `800 ${nx}px ${FONT}`;
    ctx.fillText(p.nick, textX, cy - 9);
    ctx.fillStyle = "#8A94A8";
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(POSITION_ABBR[p.position] || "—", textX, cy + 13);

    // OVR
    ctx.textAlign = "right";
    ctx.fillStyle = "#C8FF00";
    ctx.font = `italic 900 28px ${FONT}`;
    ctx.fillText(String(ovr), x + w - 18, cy);
  });
  ctx.textBaseline = "top"; ctx.textAlign = "left";
}
