import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseCsv, detectDelimiter, readXlsx, colIndex, serialToDate, serialToTime, splitHeader, mapColumns, zipEntries } from "./leagueTable.js";

// A minimal zip writer (stored central directory + deflate) so the .xlsx reader is tested on real bytes.
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n += 1) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function zip(files) {
  const parts = []; const central = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, "utf8"); const comp = deflateRawSync(data); const nm = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nm.length, 26);
    parts.push(local, nm, comp);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(crc32(data), 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nm.length, 28); cd.writeUInt32LE(offset, 42);
    central.push(cd, nm); offset += 30 + nm.length + comp.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cdBuf, end]));
}

const sheet = `<?xml version="1.0"?><worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
<row r="2"><c r="A2" s="1"><v>46278</v></c><c r="B2" s="2"><v>0.625</v></c><c r="C2" t="s"><v>4</v></c><c r="D2" t="inlineStr"><is><t>Atlético &amp; Cia</t></is></c></row>
<row r="3"><c r="A3" s="1"><v>46285</v></c><c r="C3" t="s"><v>5</v></c><c r="D3"><v>7</v></c></row>
</sheetData></worksheet>`;
const strings = `<sst>${["Data", "Hora", "Casa", "Fora", "Espinho FC", "Anta"].map((s) => `<si><t>${s}</t></si>`).join("")}</sst>`;
const styles = `<styleSheet><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="20"/></cellXfs></styleSheet>`;
const workbook = `<workbook><sheets><sheet name="Jogos" sheetId="1" r:id="rId9"/></sheets></workbook>`;
const rels = `<Relationships><Relationship Id="rId9" Type="x" Target="worksheets/sheet2.xml"/></Relationships>`;

test("parseCsv: delimiter detection, quotes, BOM and blank rows", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(detectDelimiter("a\tb\n1\t2"), "\t");
  assert.deepEqual(parseCsv('﻿Equipa;Cidade\r\n"Atlético; B";Porto\n\n"Dito ""x""";Braga\n'), [["Equipa", "Cidade"], ["Atlético; B", "Porto"], ['Dito "x"', "Braga"]]);
});

test("colIndex handles A, Z and AA", () => {
  assert.equal(colIndex("A1"), 0); assert.equal(colIndex("Z9"), 25); assert.equal(colIndex("AA3"), 26);
});

test("Excel serials become ISO date and time", () => {
  assert.equal(serialToDate(46278), "2026-09-13");
  assert.equal(serialToTime(0.625), "15:00");
});

test("readXlsx: shared and inline strings, dates, times, gaps, and the sheet named by the workbook", async () => {
  const bytes = zip({
    "xl/sharedStrings.xml": strings, "xl/styles.xml": styles, "xl/workbook.xml": workbook, "xl/_rels/workbook.xml.rels": rels,
    "xl/worksheets/sheet1.xml": "<worksheet><sheetData><row r=\"1\"><c r=\"A1\" t=\"inlineStr\"><is><t>errada</t></is></c></row></sheetData></worksheet>",
    "xl/worksheets/sheet2.xml": sheet,
  });
  assert.ok(zipEntries(bytes)["xl/worksheets/sheet2.xml"]);
  assert.deepEqual(await readXlsx(bytes), [
    ["Data", "Hora", "Casa", "Fora"],
    ["2026-09-13", "15:00", "Espinho FC", "Atlético & Cia"],
    ["2026-09-20", "", "Anta", "7"],
  ]);
});

test("readXlsx rejects non-zip bytes", async () => {
  await assert.rejects(() => readXlsx(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])), /not_zip/);
});

test("splitHeader/mapColumns find columns by alias, accents and case", () => {
  const A = { date: ["data", "date"], home: ["casa", "equipa casa", "home"], away: ["fora", "visitante", "away"] };
  const rows = [["DATA", "Equipa Casa", "Visitante"], ["2026-10-01", "A", "B"]];
  const { header, body } = splitHeader(rows, A);
  assert.deepEqual(mapColumns(header, A), { date: 0, home: 1, away: 2 });
  assert.equal(body.length, 1);
  assert.equal(splitHeader([["2026-10-01", "A", "B"]], A).header, null);
});
