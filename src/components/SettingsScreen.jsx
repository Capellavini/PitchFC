import { useState } from "react";
import { ArrowLeft, CreditCard, Settings, LogOut, ShieldCheck, Bell, Globe, PlusCircle, Moon, Sun, Building2, Mail, Phone, RotateCcw } from "lucide-react";
import { C, S, R, T, TOUCH, cardStyle } from "../theme";
import { pushSupported, pushConfigured, pushPermission } from "../lib/push";
import { t } from "../lib/i18n";
import { formatPhone } from "../lib/phone";
import SectionLabel from "./SectionLabel";
import PageHeader from "./PageHeader";
import SecuritySection from "./SecuritySection";
import ListRow from "./ListRow";
import Chip from "./Chip";
import BtnGhost from "./BtnGhost";

const iconDisc = (Icon, color = C.text2) => (
  <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Icon size={18} color={color} />
  </span>
);

/** One settings group: eyebrow + ONE card of ListRows (spec §3: no card
 *  inside a card, rows split by 1px dividers). `rows` may contain falsy
 *  entries (conditional rows) — they're dropped before dividers are set. */
function Group({ label, rows }) {
  const list = rows.filter(Boolean);
  if (!list.length) return null;
  return (
    <div style={{ marginBottom: S.xl }}>
      {label && <SectionLabel>{label}</SectionLabel>}
      <div style={{ ...cardStyle, padding: `0 ${S.lg}px` }}>
        {list.map((r, i) => <ListRow key={r.id} divider={i > 0} {...r.props} />)}
      </div>
    </div>
  );
}

/** Perfil → ⚙ Definições. Every utility that used to sit under the FUT
 *  card (contact, MB Way, group settings, language incl. English, theme,
 *  push, security, admin, logout) lives here, so the profile itself is
 *  about the player (brief §9 "Settings"). Also the home of the old
 *  "Clube" tab: "Admin · Clube" (court booking + events), admins only. */
export default function SettingsScreen({ player, onBack, isOrganizer, onEditGroup, onCreateGroup, lang, onLang, themeMode, onThemeMode, enablePush, security, isAdmin, onOpenAdmin, onOpenClube, logout, resetDemo }) {
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState(null); // { ok, text }
  const handleEnablePush = async () => {
    setPushBusy(true); setPushMsg(null);
    const res = await enablePush();
    setPushBusy(false);
    setPushMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: t("Notificações ativadas ✓") });
  };
  const pushOn = pushMsg?.ok || pushPermission() === "granted";
  const notSet = t("não definido");
  const mode = themeMode ?? "dark";

  const themeToggle = (
    <div role="radiogroup" aria-label={t("Tema")} style={{ display: "flex", background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.pill, padding: 3, gap: 2 }}>
      {[["dark", Moon, "Escuro"], ["light", Sun, "Claro"]].map(([id, Icon, label]) => {
        const active = mode === id;
        return (
          <button key={id} role="radio" aria-checked={active} onClick={() => onThemeMode(id)} title={t(label)}
            style={{ minHeight: 36, display: "flex", alignItems: "center", gap: S.xs + 1, background: active ? C.accent : "none", color: active ? C.bg : C.text2, border: "none", borderRadius: R.pill, padding: `0 ${S.md}px`, fontSize: T.meta, fontWeight: active ? 800 : 600, cursor: "pointer" }}>
            <Icon size={14} /> {t(label)}
          </button>
        );
      })}
    </div>
  );

  const langSelect = (
    <select value={lang} onChange={(e) => onLang(e.target.value)} aria-label={t("Idioma")}
      style={{ minHeight: TOUCH.min, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `0 ${S.sm + 2}px`, fontSize: T.meta + 1, fontWeight: 700, outline: "none", cursor: "pointer", colorScheme: mode }}>
      <option value="pt">🇵🇹 Português</option>
      <option value="pt-br">🇧🇷 Português (BR)</option>
      <option value="en">🇬🇧 English</option>
    </select>
  );

  return (
    <div style={{ padding: `0 ${S.lg}px ${S.xl}px` }}>
      <button onClick={onBack} aria-label={t("Voltar")}
        style={{ marginTop: S.md, width: TOUCH.min, height: TOUCH.min, marginLeft: -10, background: "none", border: "none", color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ArrowLeft size={20} />
      </button>
      <PageHeader title={t("Definições")} style={{ paddingTop: S.xs }} />

      <Group label={t("CONTA")} rows={[
        { id: "email", props: { leading: iconDisc(Mail), title: "Email", meta: player.email || notSet } },
        { id: "phone", props: { leading: iconDisc(Phone), title: t("Telemóvel"), meta: formatPhone(player.phone) || notSet } },
        { id: "mbway", props: { leading: iconDisc(CreditCard, C.blue), title: "MB Way", meta: formatPhone(player.phone) || notSet, right: player.phone ? <Chip variant="green">{t("Ativo")}</Chip> : null } },
      ]} />

      <Group label={t("GRUPO")} rows={[
        isOrganizer && { id: "group", props: { leading: iconDisc(Settings, C.blue), title: t("Definições do grupo"), meta: t("Campo, horário, mensalidade e vagas"), onClick: onEditGroup } },
        onCreateGroup && { id: "create", props: { leading: iconDisc(PlusCircle, C.accent), title: t("Criar grupo"), meta: t("Torna-te organizador do teu próprio jogo semanal"), onClick: onCreateGroup, accent: true } },
      ]} />

      <Group label={t("PREFERÊNCIAS")} rows={[
        onLang && { id: "lang", props: { leading: iconDisc(Globe), title: t("Idioma"), right: langSelect } },
        onThemeMode && { id: "theme", props: { leading: iconDisc(mode === "light" ? Sun : Moon), title: t("Tema"), right: themeToggle } },
        enablePush && pushSupported() && pushConfigured() && { id: "push", props: {
          leading: iconDisc(Bell, pushOn ? C.green : C.text2),
          title: t("Notificações"),
          meta: pushMsg && !pushMsg.ok ? pushMsg.text : pushOn ? t("Ativadas ✓ — avisamos quando entras no jogo") : t("Recebe aviso quando abrir vaga para ti"),
          right: !pushOn ? (
            <BtnGhost tone="accent" compact onClick={handleEnablePush} disabled={pushBusy} style={{ minHeight: TOUCH.min }}>
              {pushBusy ? "…" : t("Ativar")}
            </BtnGhost>
          ) : null,
        } },
      ]} />

      {/* Account security — cloud accounts only (own component, unchanged) */}
      {security && (
        <div style={{ marginBottom: S.xl }}>
          <SecuritySection
            email={security.email}
            onUpdatePassword={security.updatePassword}
            onUpdateEmail={security.updateEmail}
            onSignOutEverywhere={security.signOutEverywhere}
          />
        </div>
      )}

      {isAdmin && (
        <Group label="ADMIN" rows={[
          { id: "clube", props: { leading: iconDisc(Building2), title: t("Admin · Clube"), meta: t("Reservas de campo, eventos e jogos abertos"), onClick: onOpenClube } },
          { id: "admin", props: { leading: iconDisc(ShieldCheck, C.accent), title: t("Painel de administrador"), meta: t("Ver todos os grupos, jogadores e jogos"), onClick: onOpenAdmin } },
        ]} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
        <BtnGhost tone="danger" block onClick={logout}>
          <LogOut size={16} /> {t("Sair")}
        </BtnGhost>
        <button onClick={resetDemo} style={{ minHeight: TOUCH.min, background: "none", border: "none", fontSize: T.meta + 1, color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: S.xs + 2 }}>
          <RotateCcw size={14} /> {t("Repor demo")}
        </button>
      </div>
    </div>
  );
}
