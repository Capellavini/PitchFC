import { Cloud, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import { C, R, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import Chip from "../Chip";
import BtnGhost from "../BtnGhost";

const CHIP = {
  idle: { variant: "green", Icon: Cloud, label: "Guardado" },
  saved: { variant: "green", Icon: Cloud, label: "Guardado" },
  saving: { variant: "neutral", Icon: Loader2, label: "A guardar…" },
  error: { variant: "orange", Icon: CloudOff, label: "Sem ligação" },
  conflict: { variant: "red", Icon: TriangleAlert, label: "Conflito" },
};

/** Small pill: is what the Gestor just did safe in the cloud? */
export function LeagueSyncChip({ sync = "idle" }) {
  const c = CHIP[sync] || CHIP.idle;
  return <span role="status" aria-live="polite"><Chip variant={c.variant} Icon={c.Icon}>{t(c.label)}</Chip></span>;
}

/** Only shows when something needs the Gestor's attention. */
export function LeagueSyncBanner({ store }) {
  if (!store || !["error", "conflict"].includes(store.sync)) return null;
  const conflict = store.sync === "conflict";
  return (
    <div role="alert" style={{ border: `1px solid ${conflict ? C.red : C.orange}`, background: C.card, borderRadius: R.control, padding: `${S.md}px ${S.lg}px`, marginBottom: S.lg, fontSize: T.body, lineHeight: 1.5 }}>
      <div style={{ fontWeight: 800, marginBottom: S.xs }}>{conflict ? t("A liga mudou noutro dispositivo.") : t("Não conseguimos guardar a liga.")}</div>
      <div style={{ color: C.text2, fontSize: T.meta, marginBottom: S.md }}>
        {conflict
          ? t("Para não apagar o trabalho de outra pessoa, parámos de guardar. Recarrega para veres a versão mais recente (as alterações feitas aqui desde então perdem-se).")
          : t("Verifica a ligação à internet. Continuamos a tentar e nada do que fizeste se perdeu.")}
      </div>
      <BtnGhost onClick={conflict ? store.reload : store.retry}>{conflict ? t("Recarregar a liga") : t("Tentar outra vez")}</BtnGhost>
    </div>
  );
}
