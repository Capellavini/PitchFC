import { useState } from "react";
import { ArrowLeft, CreditCard, Settings, LogOut, ShieldCheck, Bell, Globe, PlusCircle, Moon, Sun, Building2 } from "lucide-react";
import { C, cardStyle } from "../theme";
import { pushSupported, pushConfigured, pushPermission } from "../lib/push";
import { t } from "../lib/i18n";
import SectionLabel from "./SectionLabel";
import PageHeader from "./PageHeader";
import SecuritySection from "./SecuritySection";

const iconBox = (bg, border) => ({
  width: 42, height: 42, borderRadius: 12, background: bg, border: `1px solid ${border}`,
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
});

/** Perfil → ⚙ Definições. Every utility that used to sit under the FUT
 *  card (contact, MB Way, group settings, language, theme, push,
 *  security, admin, logout) moved here unchanged, so the profile itself
 *  is about the player (brief §9 "Settings"). Also the new home of the
 *  old "Clube" tab: "Admin · Clube" (court booking + events), admins
 *  only. */
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

  const rowBtn = { ...cardStyle, width: "100%", minHeight: 44, display: "flex", alignItems: "center", gap: 12, marginBottom: 12, cursor: "pointer", textAlign: "left", color: C.text1 };

  return (
    <div style={{ padding: "0 16px 24px" }}>
      <button onClick={onBack} aria-label={t("Voltar")}
        style={{ marginTop: 12, width: 44, height: 44, marginLeft: -10, background: "none", border: "none", color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ArrowLeft size={20} />
      </button>
      <PageHeader title={t("Definições")} style={{ paddingTop: 4 }} />

      {/* Contact */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <SectionLabel>{t("CONTACTO")}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: C.text2 }}>Email</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{player.email || <span style={{ color: C.text3 }}>{t("não definido")}</span>}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: C.text2 }}>{t("Telemóvel")}</span>
            <span>{player.phone || <span style={{ color: C.text3 }}>{t("não definido")}</span>}</span>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <SectionLabel>{t("PAGAMENTO")}</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={iconBox(C.blueDim, C.blueBorder)}><CreditCard size={18} color={C.blue} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>MB Way</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{player.phone}</div>
          </div>
          <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>{t("Ativo ✓")}</span>
        </div>
      </div>

      {/* Organizer: group settings */}
      {isOrganizer && (
        <button onClick={onEditGroup} style={rowBtn}>
          <div style={iconBox(C.blueDim, C.blueBorder)}><Settings size={18} color={C.blue} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Definições do grupo")}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{t("Campo, horário, mensalidade e vagas")}</div>
          </div>
        </button>
      )}

      {/* No group yet: start their own */}
      {onCreateGroup && (
        <button onClick={onCreateGroup} style={{ ...rowBtn, border: `1px solid ${C.accentBorder}` }}>
          <div style={iconBox(C.accentDim, C.accentBorder)}><PlusCircle size={18} color={C.accent} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Criar grupo")}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{t("Torna-te organizador do teu próprio jogo semanal")}</div>
          </div>
        </button>
      )}

      {/* Language */}
      {onLang && (
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={iconBox(C.surface, C.border)}><Globe size={18} color={C.text2} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Idioma")}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>Português · Português (BR) · English · Italiano</div>
            </div>
            <select value={lang} onChange={(e) => onLang(e.target.value)}
              style={{ minHeight: 40, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 10px", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer", colorScheme: "dark" }}>
              <option value="pt">🇵🇹 PT</option>
              <option value="pt-br">🇧🇷 PT-BR</option>
              <option value="en">🇬🇧 EN</option>
              <option value="it">🇮🇹 IT</option>
            </select>
          </div>
        </div>
      )}

      {/* Theme */}
      {onThemeMode && (
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={iconBox(C.surface, C.border)}>{themeMode === "light" ? <Sun size={18} color={C.text2} /> : <Moon size={18} color={C.text2} />}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Tema")}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{t("Escuro")} · {t("Claro")}</div>
            </div>
            <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
              {[["dark", Moon, "Escuro"], ["light", Sun, "Claro"]].map(([id, Icon, label]) => {
                const active = (themeMode ?? "dark") === id;
                return (
                  <button key={id} onClick={() => onThemeMode(id)} title={t(label)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: active ? C.accentDim : "none", color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : "transparent"}`, borderRadius: 8, padding: "8px 10px", fontSize: 11, fontWeight: active ? 800 : 600, cursor: "pointer" }}>
                    <Icon size={13} /> {t(label)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Push notifications (cloud, when configured) */}
      {enablePush && pushSupported() && pushConfigured() && (
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={iconBox(pushOn ? C.greenDim : C.accentDim, pushOn ? C.greenBorder : C.accentBorder)}>
              <Bell size={18} color={pushOn ? C.green : C.accent} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Notificações")}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{pushOn ? t("Ativadas ✓ — avisamos quando entras no jogo") : t("Recebe aviso quando abrir vaga para ti")}</div>
            </div>
            {!pushOn && (
              <button onClick={handleEnablePush} disabled={pushBusy} style={{ minHeight: 40, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "0 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: pushBusy ? 0.6 : 1 }}>
                {pushBusy ? "…" : t("Ativar")}
              </button>
            )}
          </div>
          {pushMsg && !pushMsg.ok && <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>{pushMsg.text}</div>}
        </div>
      )}

      {/* Account security — cloud accounts only */}
      {security && (
        <SecuritySection
          email={security.email}
          onUpdatePassword={security.updatePassword}
          onUpdateEmail={security.updateEmail}
          onSignOutEverywhere={security.signOutEverywhere}
        />
      )}

      {/* Owner-only */}
      {isAdmin && (
        <>
          <SectionLabel style={{ marginTop: 8 }}>ADMIN</SectionLabel>
          <button onClick={onOpenClube} style={rowBtn}>
            <div style={iconBox(C.surface, C.border)}><Building2 size={18} color={C.text2} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Admin · Clube")}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{t("Reservas de campo, eventos e jogos abertos")}</div>
            </div>
          </button>
          <button onClick={onOpenAdmin} style={{ ...rowBtn, border: `1px solid ${C.accentBorder}` }}>
            <div style={iconBox(C.accentDim, C.accentBorder)}><ShieldCheck size={18} color={C.accent} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Painel de administrador")}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{t("Ver todos os grupos, jogadores e jogos")}</div>
            </div>
          </button>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={logout} style={{ flex: 1, minHeight: 44, background: "none", border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <LogOut size={14} /> {t("Sair")}
        </button>
        <button onClick={resetDemo} style={{ flex: 1, minHeight: 44, background: "none", border: `1px dashed ${C.border}`, borderRadius: 12, fontSize: 13, color: C.text3, cursor: "pointer" }}>
          {t("Repor demo")}
        </button>
      </div>
    </div>
  );
}
