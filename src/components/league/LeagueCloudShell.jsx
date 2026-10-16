import { ArrowLeft } from "lucide-react";
import { C, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import { LC } from "../../lib/leagueCloudCopy";
import Chip from "../Chip";

/** Frame of the real-league screens (/league/minhas, /league/<slug>…):
 *  back link, title, the "preview · admins only" marker while the
 *  `leagues` flag is off for everyone, and one status line. */
export default function LeagueCloudShell({ title, subtitle, backHref = "/league/minhas", notice, error, children, right }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text1 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: `${S.lg}px ${S.lg}px ${S.xxl * 2}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.md }}>
          <a href={backHref} aria-label={t(LC.back)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: TOUCH.min, minHeight: TOUCH.min, color: C.text2, textDecoration: "none" }}>
            <ArrowLeft size={20} />
          </a>
          <div style={{ flex: 1 }} />
          <Chip variant="orange">{t(LC.preview)}</Chip>
          {right}
        </div>
        <h1 style={{ margin: 0, fontSize: T.title, fontWeight: 900, lineHeight: 1.1 }}>{title}</h1>
        {subtitle ? <div style={{ fontSize: T.body, color: C.text2, marginTop: S.xs }}>{subtitle}</div> : null}
        {notice ? <div role="status" style={{ marginTop: S.md, fontSize: T.meta, color: C.green }}>{notice}</div> : null}
        {error ? <div role="alert" style={{ marginTop: S.md, fontSize: T.meta, color: C.red }}>{error}</div> : null}
        <div style={{ marginTop: S.lg }}>{children}</div>
      </div>
    </div>
  );
}
