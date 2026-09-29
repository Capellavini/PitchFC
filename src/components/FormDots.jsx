import { C, S } from "../theme";
import { t, tCtx } from "../lib/i18n";

const TONE = { V: "green", E: "orange", D: "red" };
const NAME = { V: "Vitória", E: "Empate", D: "Derrota" };

/**
 * FormDots — recent form as coloured circles with the result letter
 * (Perfil → Resumo, team/competition rows). PT-PT letters V/E/D; EN
 * shows W/D/L via tCtx("form", …).
 *
 * Props:
 *  - results  array of 'V' | 'E' | 'D', oldest → newest (newest is
 *             rendered last, on the right). Unknown values are skipped.
 *  - max      show only the last N (default 5).
 *  - size     circle diameter px (default 24).
 *  - style    container overrides.
 */
export default function FormDots({ results = [], max = 5, size = 24, style }) {
  const list = results.filter((r) => TONE[r]).slice(-max);
  if (!list.length) return null;
  return (
    <div role="list" aria-label={t("Forma recente")} style={{ display: "flex", gap: S.xs + 2, ...style }}>
      {list.map((r, i) => {
        const tone = TONE[r];
        return (
          <span key={i} role="listitem" title={t(NAME[r])} style={{
            width: size, height: size, borderRadius: "50%", flexShrink: 0,
            background: C[`${tone}Dim`], border: `1.5px solid ${C[tone]}`, color: C[tone],
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: Math.max(11, Math.round(size * 0.46)), fontWeight: 900, lineHeight: 1,
          }}>
            {tCtx("form", r)}
          </span>
        );
      })}
    </div>
  );
}
