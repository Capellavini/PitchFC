import test from "node:test";
import assert from "node:assert/strict";
import { linkUrl, linkMessage, LINK_CODE } from "./leagueWhatsApp.js";

test("the link carries the code in the prefilled text and goes to the bot number", () => {
  const url = linkUrl("LIGA-ABC234");
  assert.match(url, /^https:\/\/wa\.me\/351913813845\?text=/);
  assert.equal(decodeURIComponent(url.split("text=")[1]), linkMessage("LIGA-ABC234"));
  assert.match(linkMessage("LIGA-ABC234"), /LIGA-ABC234/);
});

test("only well-formed codes make a link (no 0/O/1/I, exactly 6)", () => {
  for (const bad of ["", null, "LIGA-ABC23", "LIGA-ABC2345", "liga-abc234", "ADJ-ABC234", "LIGA-ABO234", "LIGA-AB1234", "https://evil.test"]) assert.equal(linkUrl(bad), null, String(bad));
  assert.ok(LINK_CODE.test("LIGA-K7M2QX"));
});
