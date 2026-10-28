// Reads the spreadsheets a league already has: CSV/TSV and Excel (.xlsx).
// No dependency: an .xlsx is a zip of XML files, read here with the platform's
// DecompressionStream (browsers and Node 18+). Pure functions on bytes/text so
// they are testable; only readTableFile touches a File.
//
//   readTableFile(file) → { rows: string[][], sheet?: string } | { error }
//   Every cell comes back as a trimmed string; Excel dates become YYYY-MM-DD
//   (or HH:MM for times) when the cell is formatted as one.

export const MAX_TABLE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

// ── CSV / TSV ────────────────────────────────────────────
export function detectDelimiter(text) {
  const first = String(text).split(/\r?\n/).find((l) => l.trim()) || "";
  const counts = [";", "\t", ","].map((d) => [d, first.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** RFC-4180-ish parser: quotes, escaped quotes, newlines inside quotes. */
export function parseCsv(text, delimiter = detectDelimiter(text)) {
  const src = String(text || "").replace(/^﻿/, "");
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false; } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i += 1; row.push(cell); cell = ""; rows.push(row); row = []; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return clean(rows);
}

function clean(rows) {
  const out = rows.map((r) => r.map((c) => String(c ?? "").replace(/\s+/g, " ").trim()));
  while (out.length && out[out.length - 1].every((c) => !c)) out.pop();
  return out.filter((r) => r.some((c) => c)).slice(0, MAX_ROWS);
}

// ── XLSX ─────────────────────────────────────────────────
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Lists the entries of a zip from its central directory: { name → { method, size, csize, offset } }. */
export function zipEntries(bytes) {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) { if (u32(bytes, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error("not_zip");
  const count = u16(bytes, eocd + 10); let p = u32(bytes, eocd + 16);
  const out = {};
  for (let n = 0; n < count; n += 1) {
    if (u32(bytes, p) !== 0x02014b50) throw new Error("bad_zip");
    const nameLen = u16(bytes, p + 28); const extra = u16(bytes, p + 30); const comment = u16(bytes, p + 32);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    out[name] = { method: u16(bytes, p + 10), csize: u32(bytes, p + 20), size: u32(bytes, p + 24), offset: u32(bytes, p + 42) };
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function zipRead(bytes, entries, name) {
  const e = entries[name];
  if (!e) return null;
  const nameLen = u16(bytes, e.offset + 26); const extra = u16(bytes, e.offset + 28);
  const start = e.offset + 30 + nameLen + extra;
  const raw = bytes.subarray(start, start + e.csize);
  if (e.size > 20 * 1024 * 1024) throw new Error("too_large");
  const body = e.method === 0 ? raw : await inflateRaw(raw);
  return new TextDecoder().decode(body);
}

const unxml = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
const textOf = (xml) => [...String(xml).matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unxml(m[1])).join("");

/** "B3" → column index 1. */
export function colIndex(ref) {
  const letters = String(ref).match(/^[A-Z]+/i)?.[0].toUpperCase() || "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel serial → "YYYY-MM-DD" (the 1900 leap-year bug is already folded into the 25569 offset). */
export function serialToDate(serial) {
  const ms = Math.round((Number(serial) - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}
export function serialToTime(serial) {
  const frac = Number(serial) - Math.floor(Number(serial));
  const mins = Math.round(frac * 1440);
  return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

// Built-in number formats that are dates (14–22, 45–47) or date+time.
const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const looksLikeDateFormat = (code) => /[dmyhs]/i.test(String(code).replace(/"[^"]*"|\[[^\]]*\]|\\./g, "")) ;

function dateStyles(stylesXml) {
  const formats = {};
  for (const m of String(stylesXml || "").matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) formats[m[1]] = unxml(m[2]);
  const xfs = String(stylesXml || "").match(/<cellXfs[\s\S]*?<\/cellXfs>/)?.[0] || "";
  const out = new Set();
  [...xfs.matchAll(/<xf\b[^>]*numFmtId="(\d+)"/g)].forEach((m, i) => {
    const id = Number(m[1]);
    if (BUILTIN_DATE.has(id) || (formats[id] && looksLikeDateFormat(formats[id]))) out.add(i);
  });
  return { dateStyle: out, formats };
}

/** Rows of the first sheet of an .xlsx (bytes → string[][]). */
export async function readXlsx(bytes) {
  const entries = zipEntries(bytes);
  const shared = await zipRead(bytes, entries, "xl/sharedStrings.xml");
  const strings = shared ? [...shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];
  const { dateStyle } = dateStyles(await zipRead(bytes, entries, "xl/styles.xml"));
  // First sheet by workbook order; fall back to the lowest-numbered sheet file.
  let path = null;
  const wb = await zipRead(bytes, entries, "xl/workbook.xml");
  const rels = await zipRead(bytes, entries, "xl/_rels/workbook.xml.rels");
  const rid = wb?.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  const target = rid && rels ? rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] || rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1] : null;
  if (target) path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  if (!path || !entries[path]) path = Object.keys(entries).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))[0];
  const sheet = path ? await zipRead(bytes, entries, path) : null;
  if (!sheet) throw new Error("no_sheet");
  const rows = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]; const inner = cm[2] || "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const style = Number(attrs.match(/\bs="(\d+)"/)?.[1] ?? -1);
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = strings[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(inner);
      else if (type === "str" || type === "e") value = unxml(v ?? "");
      else if (type === "b") value = v === "1" ? "Sim" : "Não";
      else if (v !== undefined && v !== "") {
        const num = Number(v);
        if (dateStyle.has(style) && Number.isFinite(num)) value = num >= 1 ? serialToDate(num) + (num % 1 ? ` ${serialToTime(num)}` : "") : serialToTime(num);
        else value = unxml(v);
      }
      const at = ref ? colIndex(ref) : cells.length;
      while (cells.length < at) cells.push("");
      cells[at] = value;
    }
    rows.push(cells);
  }
  return clean(rows);
}

// ── Files ────────────────────────────────────────────────
export async function readTableFile(file) {
  if (!file) return { error: "no_file" };
  if (file.size > MAX_TABLE_BYTES) return { error: "too_large" };
  const name = String(file.name || "").toLowerCase();
  try {
    if (/\.xlsx$/.test(name)) return { rows: await readXlsx(new Uint8Array(await file.arrayBuffer())) };
    if (/\.xls$/.test(name)) return { error: "old_excel" }; // binary .xls: ask for .xlsx or CSV
    if (/\.(csv|tsv|txt)$/.test(name) || /^text\//.test(file.type || "")) return { rows: parseCsv(await file.text()) };
    return { error: "unsupported" };
  } catch {
    return { error: "unreadable" };
  }
}

// ── Column detection ─────────────────────────────────────
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The header row, when the first row looks like labels rather than data. */
export function splitHeader(rows, aliases) {
  const first = rows[0] || [];
  const known = Object.values(aliases).flat();
  const hits = first.filter((c) => known.includes(norm(c))).length;
  return hits >= 1 ? { header: first, body: rows.slice(1) } : { header: null, body: rows };
}

/** { field → column index } by header aliases; fields not found are absent. */
export function mapColumns(header, aliases) {
  const out = {};
  (header || []).forEach((cell, i) => {
    const n = norm(cell);
    for (const [field, names] of Object.entries(aliases)) if (out[field] === undefined && names.includes(n)) out[field] = i;
  });
  return out;
}
export const normalizeCell = norm;
