import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { fmtDateTime } from "../../lib/leagueDemo";
import { signupsCsv } from "../../lib/leagueLanding";
import SectionLabel from "../SectionLabel";
import BtnGhost from "../BtnGhost";

const SHOWN = 20;

/** Who signed up on the page for the league's Pitch Manager. Only the Gestor sees this list;
 *  the people can be removed at any time (and asked to be). */
export default function LeagueManageSignups({ ctx }) {
  const { store, state, notify, lang } = ctx;
  const api = store?.fans;
  const [rows, setRows] = useState(null); // { count, items } | null while loading
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const teamName = useMemo(() => Object.fromEntries((state.data.teams || []).map((x) => [x.id, x.name])), [state.data.teams]);

  const load = useCallback(async () => {
    const r = await api.fans();
    if (r.error) { setFailed(true); return; }
    setFailed(false);
    setRows(r.data);
  }, [api]);
  useEffect(() => { if (api) load(); }, [api, load]);
  if (!api) return null;

  const remove = async (id) => {
    setBusy(true);
    const r = await api.removeFan(id);
    setBusy(false);
    if (r.error) { notify(t("Não foi possível remover. Tenta outra vez."), "error"); return; }
    notify(t("Inscrição removida."));
    load();
  };
  const copyEmails = async () => { try { await navigator.clipboard.writeText(rows.items.map((i) => i.email).join(", ")); notify(t("Emails copiados.")); } catch { notify(t("Não foi possível copiar."), "error"); } };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([signupsCsv(rows.items, teamName)], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = "inscricoes-pitch-manager.csv";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { notify(t("Não foi possível descarregar."), "error"); }
  };

  const items = rows?.items || [];
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <div style={{ marginBottom: S.xl, maxWidth: 640 }}>
      <SectionLabel>{t("Inscrições dos adeptos")}{rows ? ` · ${rows.count}` : ""}</SectionLabel>
      <div style={{ ...cardStyle, display: "grid", gap: S.md }}>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
          {t("Adeptos que se inscreveram na página para jogar o Pitch Manager da liga. Usa estes contactos só para os avisar disso. Se alguém pedir para ser apagado, remove-o aqui.")}
        </div>
        {failed && <div role="alert">{t("Não foi possível abrir as inscrições.")} <BtnGhost compact onClick={load}>{t("Tentar outra vez")}</BtnGhost></div>}
        {!failed && !rows && <div role="status" style={{ color: C.text2 }}>{t("A abrir as inscrições…")}</div>}
        {rows && items.length === 0 && <div style={{ color: C.text2, fontSize: T.body }}>{t("Ainda ninguém se inscreveu.")}</div>}
        {items.length > 0 && (
          <>
            <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
              <BtnGhost compact onClick={copyEmails}><Copy size={14} aria-hidden /> {t("Copiar emails")}</BtnGhost>
              <BtnGhost compact onClick={download}><Download size={14} aria-hidden /> {t("Descarregar CSV")}</BtnGhost>
            </div>
            <div>
              {shown.map((i) => (
                <div key={i.id} style={{ display: "flex", alignItems: "center", gap: S.sm, padding: `${S.sm}px 0`, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: T.body, fontWeight: 700, overflowWrap: "anywhere" }}>{i.name}</div>
                    <div style={{ fontSize: T.meta, color: C.text2, overflowWrap: "anywhere" }}>{i.email}{i.team_id && teamName[i.team_id] ? ` · ${teamName[i.team_id]}` : ""} · {fmtDateTime(i.created_at, lang)}</div>
                  </div>
                  <BtnGhost compact tone="danger" disabled={busy} onClick={() => remove(i.id)}>{t("Remover")}</BtnGhost>
                </div>
              ))}
            </div>
            {items.length > SHOWN && <div><BtnGhost compact onClick={() => setAll(!all)}>{all ? t("Mostrar menos") : `${t("Ver todas")} (${items.length})`}</BtnGhost></div>}
          </>
        )}
      </div>
    </div>
  );
}
