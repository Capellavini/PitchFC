// ── Post-match share card (real data → PNG) ─────────────────
// Pure canvas rendering — no DOM, no server. Anyone who played that
// night can generate their own card: real scores, their own
// goals/assists per game, OVR, and the MVP crown only if they actually
// won that night's vote. Matches the FUT-card visual language (dark
// navy, gold ring, italic FIFA-style numbers).

import { ini, computeOverall } from "./helpers";

const W = 720, H = 1280;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Own-drawn ball glyph (outer ring + pentagon + seams) for "goals" —
 *  no emoji font dependency, renders identically everywhere. cx/cy is
 *  the icon's center, r its radius. */
export function drawBallIcon(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const pr = r * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = cx + pr * Math.cos(a), y = cy + pr * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    ctx.beginPath();
    ctx.moveTo(cx + pr * Math.cos(a), cy + pr * Math.sin(a));
    ctx.lineTo(cx + r * 0.9 * Math.cos(a), cy + r * 0.9 * Math.sin(a));
    ctx.stroke();
  }
  ctx.restore();
}

/** Own-drawn diagonal pass/arrow glyph for "assists". cx/cy is the
 *  icon's visual center, r controls its overall size. */
export function drawAssistIcon(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.26);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const x1 = cx - r * 0.75, y1 = cy + r * 0.75;
  const x2 = cx + r * 0.75, y2 = cy - r * 0.75;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = r * 0.85;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 7), y2 - headLen * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - headLen * 0.5 * Math.cos(angle), y2 - headLen * 0.5 * Math.sin(angle));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 7), y2 - headLen * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draws an icon + number pair (e.g. ball + "2"), horizontally centered
 *  as a group at (cx, cy). Used for the goals/assists row on both share
 *  cards so the layout logic doesn't get duplicated per caller. */
export function drawStatRow(ctx, cx, cy, { icon1, n1, icon2, n2, iconR, gap, groupGap, color, font }) {
  ctx.font = font;
  const s1 = String(n1), s2 = String(n2);
  const w1 = ctx.measureText(s1).width, w2 = ctx.measureText(s2).width;
  const iconD = iconR * 2;
  const rowW = iconD + gap + w1 + groupGap + iconD + gap + w2;
  let x = cx - rowW / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  ctx.fillStyle = color;
  icon1(ctx, x + iconR, cy, iconR, color); x += iconD + gap;
  ctx.fillText(s1, x, cy); x += w1 + groupGap;
  icon2(ctx, x + iconR, cy, iconR, color); x += iconD + gap;
  ctx.fillText(s2, x, cy);
  ctx.textAlign = prevAlign;
}

/** Shrinks the font size (from `startPx` down to `minPx`) until `text`
 *  measures within `maxW` at the given weight/family — needed because a
 *  night can have anywhere from 1 to 8+ games, so a fixed score font
 *  would overflow a narrow chip and bleed into its neighbour. */
export function fitFont(ctx, text, maxW, { startPx, minPx, weight, family }) {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
    px -= 2;
  }
  return px;
}

/** player: { name, nick, photo, position, attrs, uuid|id }
 *  matches: lastMatchday.matches (each optionally carrying `lines`, the
 *  per-game breakdown added in PitchApp.jsx's endMatchday)
 *  myKey: the same key used in lines/matches[].lines (uuid in cloud
 *  mode, numeric id locally) — resolves this player's own contribution. */
export async function renderPostMatchCard({ player, myKey, color, isMVP, groupName, dateLabel, matches = [], aggGoals = 0, aggAssists = 0 }) {
  const pad = 46;

  // ── score chips layout: wrap into rows instead of squeezing every
  // game into one line — a full night can easily run 6-8+ short games,
  // and cramming them side by side made adjacent scores overlap. ──
  const n = Math.max(1, matches.length);
  const minChipW = 156;
  const gap = 16;
  const availW = W - pad * 2;
  const maxCols = Math.max(1, Math.floor((availW + gap) / (minChipW + gap)));
  const cols = Math.min(n, maxCols, 4);
  const rows = Math.ceil(n / cols);
  const chipW = (availW - gap * (cols - 1)) / cols;
  const chipH = 138;
  const rowGap = 14;
  const chipsBlockH = rows * chipH + (rows - 1) * rowGap;

  const chipY = pad + 120;
  const cx0 = W / 2;
  const cy0 = chipY + chipsBlockH + 200;
  const r = 118;
  const statY = cy0 + r + 140;
  const footerY = statY + 96 + 90;
  const H_dyn = Math.max(H, footerY + 60);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H_dyn;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0A0F18";
  ctx.fillRect(0, 0, W, H_dyn);

  const [logo, photo] = await Promise.all([
    loadImage("/brand/logo.png").catch(() => null),
    player.photo ? loadImage(player.photo).catch(() => null) : Promise.resolve(null),
  ]);

  if (logo) {
    const logoH = 46;
    const logoW = logoH * (logo.width / logo.height);
    ctx.drawImage(logo, W - pad - logoW, pad, logoW, logoH);
  }

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "italic 900 36px -apple-system, sans-serif";
  ctx.fillText(player.nick, pad, pad + 2);

  ctx.font = "600 22px -apple-system, sans-serif";
  ctx.fillStyle = "#8A94A8";
  ctx.fillText(`${groupName}  ·  ${dateLabel}`, pad, pad + 56);

  matches.forEach((m, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * (chipW + gap);
    const y = chipY + row * (chipH + rowGap);
    roundRect(ctx, x, y, chipW, chipH, 18);
    ctx.fillStyle = "#121A27"; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#262E3D"; ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = "800 14px -apple-system, sans-serif";
    ctx.fillStyle = "#3D4659";
    ctx.fillText(`JOGO ${m.n}`, x + chipW / 2, y + 16);

    const homeStr = String(m.homeGoals), awayStr = String(m.awayGoals);
    const scoreStr = `${homeStr} – ${awayStr}`;
    const scorePx = fitFont(ctx, scoreStr, chipW - 24, { startPx: 38, minPx: 20, weight: "italic 900", family: "-apple-system, sans-serif" });
    const wHome = ctx.measureText(homeStr).width;
    const wSep = ctx.measureText(" – ").width;
    const wAway = ctx.measureText(awayStr).width;
    let cx = x + chipW / 2 - (wHome + wSep + wAway) / 2;
    ctx.textAlign = "left";
    ctx.font = `italic 900 ${scorePx}px -apple-system, sans-serif`;
    ctx.fillStyle = "#C8FF00"; ctx.fillText(homeStr, cx, y + 42); cx += wHome;
    ctx.fillStyle = "#3D4659"; ctx.fillText(" – ", cx, y + 42); cx += wSep;
    ctx.fillStyle = "#4895FF"; ctx.fillText(awayStr, cx, y + 42);

    const mine = (m.lines || []).find((l) => l.key === myKey);
    const statColor = (mine?.goals || mine?.assists) ? "#C8FF00" : "#5D6579";
    ctx.textBaseline = "middle";
    drawStatRow(ctx, x + chipW / 2, y + chipH - 28, {
      icon1: drawBallIcon, n1: mine?.goals || 0,
      icon2: drawAssistIcon, n2: mine?.assists || 0,
      iconR: 7, gap: 4, groupGap: 12,
      color: statColor, font: "700 15px -apple-system, sans-serif",
    });
    ctx.textBaseline = "top";
  });
  ctx.textAlign = "left";
  ctx.save();
  ctx.beginPath(); ctx.arc(cx0, cy0, r, 0, Math.PI * 2); ctx.closePath();
  if (photo) {
    ctx.clip();
    ctx.drawImage(photo, cx0 - r, cy0 - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = `${color}33`;
    ctx.fill();
  }
  ctx.restore();

  ctx.lineWidth = 7;
  ctx.strokeStyle = "#E8C547";
  ctx.beginPath(); ctx.arc(cx0, cy0, r, 0, Math.PI * 2); ctx.stroke();

  if (!photo) {
    ctx.fillStyle = color;
    ctx.font = "900 78px -apple-system, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ini(player.name), cx0, cy0 + 4);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
  }

  // OVR badge, bottom-left of the avatar
  const ovr = computeOverall(player.position, player.attrs);
  ctx.font = "900 22px -apple-system, sans-serif";
  const ovrText = String(ovr);
  const ovrW = ctx.measureText(ovrText).width + 22;
  roundRect(ctx, cx0 - r - 8, cy0 + r - 34, ovrW, 42, 12);
  ctx.fillStyle = "#C8FF00"; ctx.fill();
  ctx.fillStyle = "#0A0F18";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ovrText, cx0 - r - 8 + ovrW / 2, cy0 + r - 13);

  // MVP crown, only if this player actually won that night's vote
  if (isMVP) {
    const bx = cx0 + r - 6, by = cy0 - r - 6, br = 40;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = "#E8C547"; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = "#0A0F18"; ctx.stroke();
    ctx.font = `${br}px serif`;
    ctx.fillStyle = "#0A0F18";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("👑", bx, by + 2);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "top";

  // name + position
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "italic 900 46px -apple-system, sans-serif";
  ctx.fillText(player.nick.toUpperCase(), cx0, cy0 + r + 36);
  ctx.font = "700 20px -apple-system, sans-serif";
  ctx.fillStyle = "#8A94A8";
  ctx.fillText(player.position || "", cx0, cy0 + r + 90);

  // aggregate stat row
  const stats = [["GOLOS", aggGoals], ["ASSIST.", aggAssists]];
  const statChipW = 180, statGap = 20;
  const statsTotalW = stats.length * statChipW + (stats.length - 1) * statGap;
  let sx = cx0 - statsTotalW / 2;
  stats.forEach(([label, value]) => {
    roundRect(ctx, sx, statY, statChipW, 96, 18);
    ctx.fillStyle = "#121A27"; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#262E3D"; ctx.stroke();
    ctx.font = "italic 900 40px -apple-system, sans-serif";
    ctx.fillStyle = "#C8FF00";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(String(value), sx + statChipW / 2, statY + 14);
    ctx.font = "700 14px -apple-system, sans-serif";
    ctx.fillStyle = "#8A94A8";
    ctx.fillText(label, sx + statChipW / 2, statY + 64);
    sx += statChipW + statGap;
  });

  // footer
  ctx.font = "600 18px -apple-system, sans-serif";
  ctx.fillStyle = "#3D4659";
  ctx.textAlign = "center";
  ctx.fillText("pitch-fc.vercel.app", cx0, H_dyn - 56);

  return canvas.toDataURL("image/png");
}

/** Converts the card's dataURL into a File, for the Web Share API
 *  (lets the user pick WhatsApp directly with the image attached). */
export function dataUrlToFile(dataUrl, filename) {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** iOS Safari has never honored the `download` attribute on `<a>` tags
 *  (clicking it just opens the image instead of saving it) — the only
 *  way to get a real "save image" affordance there is the share sheet. */
export function isIOSDevice() {
  return /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Opens the native share sheet with the card image attached (so apps
 *  like WhatsApp get the file itself, not just a link). Falls back to
 *  a direct download when Web Share isn't available. */
export async function shareCard(dataUrl, filename) {
  const file = dataUrlToFile(dataUrl, filename);
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "PITCH" }); } catch { /* user cancelled the share sheet */ }
    return;
  }
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename; a.click();
}

/** Saves the card image directly. On iOS this routes through the share
 *  sheet instead (see isIOSDevice) since a plain anchor download is a
 *  silent no-op there. */
export function downloadCard(dataUrl, filename) {
  if (isIOSDevice()) return shareCard(dataUrl, filename);
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename; a.click();
}
