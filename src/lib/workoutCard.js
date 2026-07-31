// ── Workout share card (Strava-style, PNG) ──────────────────
// Full-bleed cover photo (the game/location shot) with watch stats
// typed in by hand — a web app can't read HealthKit, so this is the
// manual bridge — plus the player's own goals/assists for that
// matchday, if they played. Same canvas-rendering approach as
// postMatchCard.js (no DOM, no server).

import { loadImage, roundRect, fitFont } from "./postMatchCard";

const W = 720, H = 960;

function fmtDuration(min) {
  if (!min) return null;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

/** watch: { distanceKm, durationMin, calories, avgHr } — any may be
 *  omitted (blank input); only provided ones render as a chip.
 *  pitch: { goals, assists } or null when the player didn't play a
 *  matchday around this workout. */
export async function renderWorkoutCard({ photoFile, playerNick, groupName, dateLabel, watch = {}, pitch = null }) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0A0F18";
  ctx.fillRect(0, 0, W, H);

  const [logo, photo] = await Promise.all([
    loadImage("/brand/logo.png").catch(() => null),
    photoFile ? loadImage(URL.createObjectURL(photoFile)).catch(() => null) : Promise.resolve(null),
  ]);

  if (photo) {
    const scale = Math.max(W / photo.width, H / photo.height);
    const sw = W / scale, sh = H / scale;
    const sx = (photo.width - sw) / 2, sy = (photo.height - sh) / 2;
    ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, W, H);
  }

  // top scrim (header legibility) + bottom scrim (stats legibility)
  const top = ctx.createLinearGradient(0, 0, 0, 200);
  top.addColorStop(0, "rgba(10,15,24,0.85)");
  top.addColorStop(1, "rgba(10,15,24,0)");
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 200);

  const bottomStart = H * 0.42;
  const bottom = ctx.createLinearGradient(0, bottomStart, 0, H);
  bottom.addColorStop(0, "rgba(10,15,24,0)");
  bottom.addColorStop(1, "rgba(10,15,24,0.97)");
  ctx.fillStyle = bottom; ctx.fillRect(0, bottomStart, W, H - bottomStart);

  // header: logo + nick / group · date
  ctx.textBaseline = "top";
  if (logo) {
    const logoH = 34, logoW = logoH * (logo.width / logo.height);
    ctx.drawImage(logo, 28, 28, logoW, logoH);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "italic 900 30px -apple-system, sans-serif";
  ctx.fillText(playerNick || "", 28, 78);
  ctx.font = "600 18px -apple-system, sans-serif";
  ctx.fillStyle = "#C7CEDB";
  ctx.fillText([groupName, dateLabel].filter(Boolean).join("  ·  "), 28, 112);

  // stat chips: only the ones the player actually typed in
  const chips = [
    watch.distanceKm ? [`${Number(watch.distanceKm).toFixed(1)} km`, "DISTÂNCIA"] : null,
    fmtDuration(watch.durationMin) ? [fmtDuration(watch.durationMin), "DURAÇÃO"] : null,
    watch.calories ? [String(Math.round(watch.calories)), "KCAL"] : null,
    watch.avgHr ? [`${Math.round(watch.avgHr)}`, "FC MÉDIA"] : null,
  ].filter(Boolean);

  const pad = 28;
  const gap = 14;
  const chipsY = H - (pitch ? 300 : 210);
  const chipH = 128;
  if (chips.length > 0) {
    const chipW = (W - pad * 2 - gap * (chips.length - 1)) / chips.length;
    chips.forEach(([value, label], i) => {
      const x = pad + i * (chipW + gap);
      roundRect(ctx, x, chipsY, chipW, chipH, 16);
      ctx.fillStyle = "rgba(18,26,39,0.72)"; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(38,46,61,0.9)"; ctx.stroke();

      ctx.textAlign = "center";
      const valuePx = fitFont(ctx, value, chipW - 16, { startPx: 34, minPx: 18, weight: "italic 900", family: "-apple-system, sans-serif" });
      ctx.font = `italic 900 ${valuePx}px -apple-system, sans-serif`;
      ctx.fillStyle = "#C8FF00";
      ctx.fillText(value, x + chipW / 2, chipsY + 24);

      ctx.font = "700 12px -apple-system, sans-serif";
      ctx.fillStyle = "#8A94A8";
      ctx.fillText(label, x + chipW / 2, chipsY + 96);
    });
  }

  // Pitch performance row — only when the player actually played that
  // matchday; a solo run day has no goals/assists to show.
  if (pitch) {
    const y = H - 160;
    roundRect(ctx, pad, y, W - pad * 2, 92, 16);
    ctx.fillStyle = "rgba(200,255,0,0.1)"; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(200,255,0,0.35)"; ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 32px -apple-system, sans-serif";
    ctx.fillStyle = "#C8FF00";
    ctx.fillText(`⚽ ${pitch.goals || 0}   🎯 ${pitch.assists || 0}`, W / 2, y + 46);
    ctx.textBaseline = "top";
  }

  ctx.textAlign = "center";
  ctx.font = "600 16px -apple-system, sans-serif";
  ctx.fillStyle = "#3D4659";
  ctx.fillText("pitch-fc.vercel.app", W / 2, H - 34);

  return canvas.toDataURL("image/png");
}
