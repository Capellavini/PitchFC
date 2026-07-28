// ── Post-match share card (real data → PNG) ─────────────────
// Pure canvas rendering — no DOM, no server. Anyone who played that
// night can generate their own card: real scores, their own
// goals/assists per game, OVR, and the MVP crown only if they actually
// won that night's vote. Matches the FUT-card visual language (dark
// navy, gold ring, italic FIFA-style numbers).

import { ini, computeOverall } from "./helpers";

const W = 720, H = 1280;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** player: { name, nick, photo, position, attrs, uuid|id }
 *  matches: lastMatchday.matches (each optionally carrying `lines`, the
 *  per-game breakdown added in PitchApp.jsx's endMatchday)
 *  myKey: the same key used in lines/matches[].lines (uuid in cloud
 *  mode, numeric id locally) — resolves this player's own contribution. */
export async function renderPostMatchCard({ player, myKey, color, isMVP, groupName, dateLabel, matches = [], aggGoals = 0, aggAssists = 0 }) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0A0F18";
  ctx.fillRect(0, 0, W, H);

  const pad = 46;
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

  // ── score chips, one per game that night ──
  const chipY = pad + 120;
  const chipH = 156;
  const gap = 18;
  const n = Math.max(1, matches.length);
  const chipW = (W - pad * 2 - gap * (n - 1)) / n;
  matches.forEach((m, i) => {
    const x = pad + i * (chipW + gap);
    roundRect(ctx, x, chipY, chipW, chipH, 20);
    ctx.fillStyle = "#121A27"; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#262E3D"; ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = "800 15px -apple-system, sans-serif";
    ctx.fillStyle = "#3D4659";
    ctx.fillText(`JOGO ${m.n}`, x + chipW / 2, chipY + 18);

    ctx.font = "italic 900 40px -apple-system, sans-serif";
    const homeStr = String(m.homeGoals), awayStr = String(m.awayGoals);
    const wHome = ctx.measureText(homeStr).width;
    const wSep = ctx.measureText(" – ").width;
    const wAway = ctx.measureText(awayStr).width;
    let cx = x + chipW / 2 - (wHome + wSep + wAway) / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = "#C8FF00"; ctx.fillText(homeStr, cx, chipY + 46); cx += wHome;
    ctx.fillStyle = "#3D4659"; ctx.fillText(" – ", cx, chipY + 46); cx += wSep;
    ctx.fillStyle = "#4895FF"; ctx.fillText(awayStr, cx, chipY + 46);

    const mine = (m.lines || []).find((l) => l.key === myKey);
    ctx.textAlign = "center";
    ctx.font = "700 18px -apple-system, sans-serif";
    ctx.fillStyle = (mine?.goals || mine?.assists) ? "#C8FF00" : "#5D6579";
    ctx.fillText(`⚽ ${mine?.goals || 0}    🎯 ${mine?.assists || 0}`, x + chipW / 2, chipY + chipH - 40);
  });
  ctx.textAlign = "left";

  // ── player spotlight ──
  const cx0 = W / 2;
  const cy0 = chipY + chipH + 210;
  const r = 118;
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
  const statY = cy0 + r + 140;
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
  ctx.fillText("pitch-fc.vercel.app", cx0, H - 56);

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
