import { C, R, displayFont } from "../../theme";
import { LEAGUE } from "../../lib/leagueDemo";
import { safeLogo, onColor } from "../../lib/leagueBrand";

const initialsOf = (name) => {
  const words = String(name || "").split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ0-9]/.test(w[0] || ""));
  return (words.length > 1 ? words.map((w) => w[0]).join("") : String(name || "L").replace(/[^A-Za-zÀ-ÿ0-9]/g, "")).slice(0, 3).toUpperCase() || "L";
};

/** The league's mark: its logo when it has one, else its initials on the
 *  league colour (taken from the logo). Decorative — the name is next to it. */
export default function LeagueMark({ size = 40 }) {
  const logo = safeLogo(LEAGUE.logo);
  const color = /^#[0-9A-F]{6}$/i.test(LEAGUE.color || "") ? LEAGUE.color : null;
  return (
    <span aria-hidden style={{ width: size, height: size, flexShrink: 0, borderRadius: R.control, overflow: "hidden", display: "inline-grid", placeItems: "center", background: logo ? C.surface : (color || C.accentDim), border: `2px solid ${color || C.accentBorder}`, boxSizing: "border-box" }}>
      {logo
        ? <img src={logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        : <span style={{ ...displayFont, fontSize: size * 0.34, color: color ? onColor(color) : C.accent, lineHeight: 1 }}>{initialsOf(LEAGUE.name)}</span>}
    </span>
  );
}
