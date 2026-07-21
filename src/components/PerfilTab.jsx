import { useState } from "react";
import { Pencil, CreditCard, Camera, Settings, LogOut, Star, MessageCircle, ShieldCheck, Bell, Globe } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { pushSupported, pushConfigured, pushPermission } from "../lib/push";
import { TOTAL_GAMES, POSITIONS, FEET, NATIONALITIES } from "../data";
import { encodePayload } from "../lib/helpers";
import { t } from "../lib/i18n";
import { openWhatsApp, rateRequestMessage } from "../lib/whatsapp";
import FutCard from "./FutCard";
import RatingForm from "./RatingForm";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import SecuritySection from "./SecuritySection";

export default function PerfilTab({ group, viewPlayerId, updateProfile, backToMe, resetDemo, isOrganizer, onEditGroup, logout, addPeerRating, cloudMode, onSubmitRating, isAdmin, onOpenAdmin, uploadMedia, enablePush, security, lang, onLang }) {
  const me = group.find((p) => p.isMe);
  const player = group.find((p) => p.id === viewPlayerId) ?? me;
  const isOwn = player.isMe;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(player);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeStatus, setCodeStatus] = useState(null); // 'ok' | 'error'
  const [uploading, setUploading] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState(null); // { ok, text }

  const handleEnablePush = async () => {
    setPushBusy(true); setPushMsg(null);
    const res = await enablePush();
    setPushBusy(false);
    setPushMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: t("Notificações ativadas ✓") });
  };
  const pushOn = pushMsg?.ok || pushPermission() === "granted";

  const startEditing = () => { setForm({ ...player }); setEditing(true); };

  const requestRating = () => {
    const payload = encodePayload({
      name: player.name, nick: player.nick, position: player.position,
      club: player.club, nationality: player.nationality, foot: player.foot, age: player.age,
    });
    openWhatsApp(rateRequestMessage(player.nick, `${window.location.origin}?rate=${encodeURIComponent(payload)}`));
  };

  const submitCode = () => {
    const ok = addPeerRating(codeDraft);
    setCodeStatus(ok ? "ok" : "error");
    if (ok) setCodeDraft("");
  };

  const attendance = Math.round((player.gamesPlayed / TOTAL_GAMES) * 100);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const res = await uploadMedia(file);
    setUploading(false);
    if (res?.url) setForm((f) => ({ ...f, photo: res.url }));
  };

  const field = (label, key, type = "text") => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
        style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }}
      />
    </div>
  );

  const selectField = (label, key, options) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
      <select value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px", fontSize: 13, color: C.text1, outline: "none" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const chips = (label, key, options) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const active = form[key] === opt;
          return (
            <button key={opt} onClick={() => setForm({ ...form, [key]: opt })} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 13px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
              {t(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (editing) {
    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22, padding: "20px 0 16px" }}>{t("Editar Perfil")}</div>

        <label style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, marginBottom: 14, cursor: "pointer" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Camera size={19} color={C.accent} />
          </div>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{uploading ? t("A carregar…") : form.photo ? t("Trocar fotografia") : t("Adicionar fotografia")}</div>
          {form.photo && <img src={form.photo} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />}
          <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
        </label>

        <div style={{ ...cardStyle, marginBottom: 14 }}>
          {field(t("Nome completo"), "name")}
          {field(t("Alcunha (nome no cartão)"), "nick")}
          {field("Email", "email", "email")}
          {field(t("Telemóvel (MB Way)"), "phone", "tel")}
          {field(t("Idade"), "age", "number")}
          {selectField(t("Nacionalidade"), "nationality", NATIONALITIES)}
          {field(t("Clube do coração"), "club")}
          {chips(t("Posição"), "position", POSITIONS)}
          {chips(t("Pé dominante"), "foot", FEET)}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <BtnPrimary onClick={() => { updateProfile(form); setEditing(false); }} disabled={uploading} style={{ flex: 1, opacity: uploading ? 0.6 : 1 }}>{uploading ? t("A carregar…") : t("Guardar")}</BtnPrimary>
          <button onClick={() => { setForm(player); setEditing(false); }} style={{ flex: 1, background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{t("Cancelar")}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>{isOwn ? t("O Meu Cartão") : t("Perfil")}</div>
        {isOwn ? (
          <button onClick={startEditing} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Pencil size={13} /> {t("Editar")}
          </button>
        ) : (
          <button onClick={backToMe} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 14px", fontSize: 12, color: C.text2, cursor: "pointer" }}>
            {t("Ver o meu")}
          </button>
        )}
      </div>

      {/* FUT card — the hero of the profile */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <FutCard player={player} width={280} ratingsCount={player.ratingsCount} />
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: C.text2, marginBottom: 16 }}>
        {player.name} · @{player.nick.toLowerCase()}
      </div>

      {/* Ratings: own profile shows status + who's rated you; someone
          else's profile (cloud) lets you rate them right here. */}
      {isOwn ? (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>{t("AVALIAÇÃO DOS AMIGOS")}</SectionLabel>
          <div style={{ fontSize: 12, color: C.text2, marginBottom: 14 }}>
            {(player.ratingsCount ?? 0) >= 3
              ? t("O cartão mostra a média das avaliações que recebeste.")
              : `${t("Faltam")} ${Math.max(0, 3 - (player.ratingsCount ?? 0))} ${t("avaliações para desbloquear o teu cartão.")}`}
          </div>

          <SectionLabel style={{ marginBottom: 8, color: C.text3 }}>{t("QUEM JÁ TE AVALIOU")}</SectionLabel>
          {player.raters?.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: cloudMode ? 0 : 14 }}>
              {player.raters.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <Star size={12} color={C.gold} /> {r.nick}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.text3, marginBottom: cloudMode ? 0 : 14 }}>
              {t("Ainda ninguém te avaliou.")}
            </div>
          )}

          {!cloudMode && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={requestRating} style={{ flex: 1.4, background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: 11, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <MessageCircle size={14} /> {t("Pedir avaliação")}
                </button>
                <button onClick={() => { setCodeOpen(!codeOpen); setCodeStatus(null); }} style={{ flex: 1, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Star size={14} /> {t("Inserir código")}
                </button>
              </div>

              {codeOpen && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={codeDraft} onChange={(e) => { setCodeDraft(e.target.value); setCodeStatus(null); }} placeholder={t("Cola aqui o código recebido…")}
                      style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 12, color: C.text1, outline: "none", fontFamily: "monospace" }} />
                    <button onClick={submitCode} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "0 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                      {t("Adicionar")}
                    </button>
                  </div>
                  {codeStatus === "ok" && <div style={{ fontSize: 11, color: C.green, marginTop: 6 }}>{t("Avaliação adicionada — o teu cartão já reflete a opinião ✓")}</div>}
                  {codeStatus === "error" && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>{t("Código inválido — confirma que copiaste tudo.")}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        cloudMode && onSubmitRating && (
          <RatingForm
            nick={player.nick}
            existing={player.myRatingAttrs}
            onSubmit={(attrs) => onSubmitRating(player.uuid, attrs)}
          />
        )
      )}

      {/* Contact (own profile only) */}
      {isOwn && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>{t("CONTACTO")}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: C.text2 }}>Email</span>
              <span>{player.email || <span style={{ color: C.text3 }}>{t("não definido")}</span>}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: C.text2 }}>{t("Telemóvel")}</span>
              <span>{player.phone || <span style={{ color: C.text3 }}>{t("não definido")}</span>}</span>
            </div>
          </div>
        </div>
      )}

      {/* Season stats */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionLabel>{t("TEMPORADA")}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: t("Jogos"),        value: player.gamesPlayed },
            { label: t("Golos"),        value: player.goals       },
            { label: t("Assistências"), value: player.assists     },
            { label: "MVPs",            value: player.mvps        },
            { label: t("Presença"),     value: `${attendance}%`   },
            { label: t("G+A / jogo"),   value: player.gamesPlayed ? ((player.goals + player.assists) / player.gamesPlayed).toFixed(1) : "0" },
          ].map((s) => (
            <div key={s.label} style={{ background: C.surface, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ ...displayFont, fontSize: 22, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.text2, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment method (own profile only) */}
      {isOwn && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>{t("PAGAMENTO")}</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: C.blueDim, border: `1px solid ${C.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={18} color={C.blue} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>MB Way</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{player.phone}</div>
            </div>
            <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>{t("Ativo ✓")}</span>
          </div>
        </div>
      )}

      {/* Organizer: group settings */}
      {isOwn && isOrganizer && (
        <button onClick={onEditGroup} style={{ ...cardStyle, width: "100%", display: "flex", alignItems: "center", gap: 12, marginBottom: 14, cursor: "pointer", textAlign: "left", color: C.text1 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: C.blueDim, border: `1px solid ${C.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Settings size={18} color={C.blue} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Definições do grupo")}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{t("Campo, horário, mensalidade e vagas")}</div>
          </div>
        </button>
      )}

      {/* Language picker */}
      {isOwn && onLang && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Globe size={18} color={C.text2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Idioma")}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>Português · English</div>
            </div>
            <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 2, gap: 2 }}>
              {[["pt", "🇵🇹 PT"], ["en", "🇬🇧 EN"]].map(([l, label]) => (
                <button key={l} onClick={() => onLang(l)}
                  style={{ background: lang === l ? C.accent : "transparent", color: lang === l ? C.bg : C.text2, border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Push notifications opt-in (own profile, cloud, when configured) */}
      {isOwn && enablePush && pushSupported() && pushConfigured() && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: pushOn ? C.greenDim : C.accentDim, border: `1px solid ${pushOn ? C.greenBorder : C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bell size={18} color={pushOn ? C.green : C.accent} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Notificações")}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{pushOn ? t("Ativadas ✓ — avisamos quando entras no jogo") : t("Recebe aviso quando abrir vaga para ti")}</div>
            </div>
            {!pushOn && (
              <button onClick={handleEnablePush} disabled={pushBusy} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: pushBusy ? 0.6 : 1 }}>
                {pushBusy ? "…" : t("Ativar")}
              </button>
            )}
          </div>
          {pushMsg && !pushMsg.ok && <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>{pushMsg.text}</div>}
        </div>
      )}

      {/* Account security — cloud accounts only */}
      {isOwn && security && (
        <SecuritySection
          email={security.email}
          onUpdatePassword={security.updatePassword}
          onUpdateEmail={security.updateEmail}
          onSignOutEverywhere={security.signOutEverywhere}
        />
      )}

      {/* Owner-only: cross-group admin overview */}
      {isOwn && isAdmin && (
        <button onClick={onOpenAdmin} style={{ ...cardStyle, width: "100%", display: "flex", alignItems: "center", gap: 12, marginBottom: 14, cursor: "pointer", textAlign: "left", color: C.text1, border: `1px solid ${C.accentBorder}` }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShieldCheck size={18} color={C.accent} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Painel de administrador")}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{t("Ver todos os grupos, jogadores e jogos")}</div>
          </div>
        </button>
      )}

      {isOwn && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button onClick={logout} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontSize: 12, color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <LogOut size={13} /> {t("Sair")}
          </button>
          <button onClick={resetDemo} style={{ flex: 1, background: "none", border: `1px dashed ${C.border}`, borderRadius: 12, padding: 11, fontSize: 12, color: C.text3, cursor: "pointer" }}>
            {t("Repor demo")}
          </button>
        </div>
      )}
    </div>
  );
}
