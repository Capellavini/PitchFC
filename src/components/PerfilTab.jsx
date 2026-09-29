import { useState } from "react";
import { Pencil, Camera, Settings, Cross, ArrowLeft, Users, Shield } from "lucide-react";
import { C, S, R, T, TOUCH, cardStyle, displayFont } from "../theme";
import { POSITIONS, FEET, NATIONALITIES } from "../data";
import { encodePayload, computeOverall, playerColor } from "../lib/helpers";
import { t, tCtx } from "../lib/i18n";
import { openWhatsApp, rateRequestMessage } from "../lib/whatsapp";
import { formFor, careerRecordsFor } from "../lib/profileStats";
import FutCard from "./FutCard";
import RatingForm from "./RatingForm";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import PageHeader from "./PageHeader";
import Avatar from "./Avatar";
import Chip from "./Chip";
import ListRow from "./ListRow";
import StatTile from "./StatTile";
import FormDots from "./FormDots";
import SegmentedControl from "./SegmentedControl";
import CareerSummary from "./CareerSummary";
import PeerRatingsCard from "./PeerRatingsCard";
import AchievementsSection from "./AchievementsSection";
import MatchdayCalendar from "./MatchdayCalendar";
import ProgressChart from "./ProgressChart";

const SEGMENTS = [
  { id: "resumo", label: "Resumo" },
  { id: "stats", label: "Stats" },
  { id: "conquistas", label: "Conquistas" },
  { id: "calendario", label: "Calendário" },
];

// Same thresholds as FutCard's tiers, but only C tokens (badge on the hero).
const tierColor = (overall) => (overall >= 80 ? C.gold : overall >= 70 ? C.silver : C.bronze);

const iconDisc = (Icon) => (
  <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Icon size={18} color={C.text2} />
  </span>
);

const roleLabel = (role) => (role === "organizer" ? t("Organizador") : role === "assistant" ? t("Auxiliar") : t("Membro"));

/** Perfil (EN "Me") — the player's PITCH ID (spec §2): hero (avatar +
 *  OVR badge, NAME, position · city · group), 4-stat row, then a
 *  segmented Resumo | Stats | Conquistas | Calendário. Settings live
 *  behind the gear (SettingsScreen, rendered by PitchApp via
 *  `onOpenSettings`). Viewing someone else's profile (openProfile) hides
 *  gear/edit and shows the cloud RatingForm instead of the ratings card. */
export default function PerfilTab({ group, viewPlayerId, updateProfile, backToMe, isOrganizer, addPeerRating, cloudMode, onSubmitRating, uploadMedia, onToggleInjured, achievementMatchdays, totalGames, records = [], onBanMember, onOpenSettings, personalRecords, attendanceStreak = 0, groupName, city, myGroups = [], activeGroupId, myTeams = [], localMatchday }) {
  const me = group.find((p) => p.isMe);
  const player = group.find((p) => p.id === viewPlayerId) ?? me;
  const isOwn = player.isMe;
  const [section, setSection] = useState("resumo");
  const [editing, setEditing] = useState(false);
  const [banText, setBanText] = useState("");
  const [banBusy, setBanBusy] = useState(false);
  const [banError, setBanError] = useState(null);
  const banMatches = banText.trim().toLowerCase() === (player.nick || "").toLowerCase();
  const submitBan = async () => {
    setBanError(null);
    setBanBusy(true);
    const res = await onBanMember(player.id, player.nick);
    setBanBusy(false);
    if (res?.error) setBanError(res.error);
    else setBanText("");
  };
  const [form, setForm] = useState(player);
  const [uploading, setUploading] = useState(false);

  const startEditing = () => { setForm({ ...player }); setEditing(true); };

  const requestRating = () => {
    const payload = encodePayload({
      name: player.name, nick: player.nick, position: player.position,
      club: player.club, nationality: player.nationality, foot: player.foot, age: player.age,
    });
    openWhatsApp(rateRequestMessage(player.nick, `${window.location.origin}?rate=${encodeURIComponent(payload)}`));
  };

  // Real season game count (from the group's actual matchday history).
  const attendance = totalGames ? Math.min(100, Math.round((player.gamesPlayed / totalGames) * 100)) : 0;
  const gp = player.gamesPlayed || 0;
  const perGame = (n) => (gp ? ((n || 0) / gp).toFixed(1) : "0");

  // Same overall-lock rule as the FUT card (3+ peer ratings).
  const overallLocked = player.ratingsCount != null && player.ratingsCount < 3;
  const overall = overallLocked ? 0 : computeOverall(player.position, player.attrs);
  const playerKey = cloudMode ? player.uuid : player.id;
  const achievementsCtx = {
    attendancePct: attendance,
    matchdays: achievementMatchdays ?? [],
    playerKey,
    overall,
    isLeader: Boolean(player.isOrganizerPlayer || player.isAssistant),
  };

  // Normalized matchday list (newest first) for form / records /
  // calendar / progress. Cloud keeps the whole season; local demo passes
  // its dated seed + the last matchday played in this browser as
  // `records` too (PitchApp's localDays). `localMatchday` is only the
  // fallback for an empty list.
  const days = cloudMode || records.length
    ? records.map((r) => ({ date: r.date, playedOn: r.playedOn, mvpNick: r.mvpNick, summary: r.summary }))
    : (localMatchday ? [{ date: localMatchday.date, summary: localMatchday }] : []);
  const form5 = formFor(days, playerKey).slice(-5);
  const career = careerRecordsFor(days, playerKey);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const res = await uploadMedia(file);
    setUploading(false);
    if (res?.url) setForm((f) => ({ ...f, photo: res.url }));
  };

  const labelStyle = { fontSize: T.meta, fontWeight: 700, color: C.text2, marginBottom: S.xs + 2 };
  const inputStyle = { width: "100%", minHeight: TOUCH.min, boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `0 ${S.md}px`, fontSize: T.body, color: C.text1, outline: "none" };

  const field = (label, key, type = "text") => (
    <div style={{ marginBottom: S.md }}>
      <div style={labelStyle}>{label}</div>
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
        style={inputStyle}
      />
    </div>
  );

  const selectField = (label, key, options) => (
    <div style={{ marginBottom: S.md }}>
      <div style={labelStyle}>{label}</div>
      <select value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={{ ...inputStyle, padding: `0 ${S.sm}px` }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const chips = (label, key, options) => (
    <div style={{ marginBottom: S.md }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const active = form[key] === opt;
          return (
            <button key={opt} onClick={() => setForm({ ...form, [key]: opt })} style={{ minHeight: 40, background: active ? C.accent : "transparent", color: active ? C.bg : C.text2, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: R.pill, padding: `0 ${S.md + 2}px`, fontSize: T.meta + 1, fontWeight: active ? 800 : 600, cursor: "pointer" }}>
              {t(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (editing) {
    return (
      <div style={{ padding: `0 ${S.lg}px ${S.xl}px` }}>
        <button onClick={() => { setForm(player); setEditing(false); }} aria-label={t("Voltar")}
          style={{ marginTop: S.md, width: TOUCH.min, height: TOUCH.min, marginLeft: -10, background: "none", border: "none", color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} />
        </button>
        <PageHeader title={t("Editar perfil")} style={{ paddingTop: S.xs }} />

        <label style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.md, marginBottom: S.lg, cursor: "pointer" }}>
          {form.photo
            ? <img src={form.photo} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
            : <span style={{ width: 48, height: 48, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Camera size={20} color={C.text2} /></span>}
          <div style={{ flex: 1, fontSize: T.body, fontWeight: 700 }}>{uploading ? t("A carregar…") : form.photo ? t("Trocar fotografia") : t("Adicionar fotografia")}</div>
          <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
        </label>

        <div style={{ ...cardStyle, marginBottom: S.lg }}>
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

        <div style={{ display: "flex", gap: S.sm }}>
          <BtnPrimary onClick={() => { updateProfile(form); setEditing(false); }} disabled={uploading} style={{ flex: 1 }}>{uploading ? t("A carregar…") : t("Guardar")}</BtnPrimary>
          <BtnGhost onClick={() => { setForm(player); setEditing(false); }} style={{ flex: 1 }}>{t("Cancelar")}</BtnGhost>
        </div>
      </div>
    );
  }

  // ── Hero ──────────────────────────────────────────────
  const heroMeta = [t(player.position || "Médio"), city, groupName].filter(Boolean).join(" · ");
  const badgeColor = overallLocked ? C.text2 : tierColor(overall);

  // Groups (own profile, cloud: every membership; otherwise the current
  // group, which is the only one we know the viewed player belongs to).
  const groupRows = isOwn && myGroups.length
    ? myGroups.map((m) => ({ id: m.group_id, name: m.groups?.name ?? "—", meta: [roleLabel(m.role), m.groups?.venue].filter(Boolean).join(" · "), active: m.group_id === activeGroupId }))
    : (groupName ? [{ id: "current", name: groupName, meta: player.isOrganizerPlayer ? t("Organizador") : player.isAssistant ? t("Auxiliar") : t("Membro"), active: true }] : []);
  const teamRows = isOwn ? myTeams.filter((m) => m.teams).map((m) => ({ id: m.team_id, name: m.teams.name, meta: [m.role === "captain" ? t("Capitão") : t("Plantel"), m.teams.city].filter(Boolean).join(" · ") })) : [];

  return (
    <div style={{ padding: `0 ${S.lg}px ${S.xl}px` }}>
      {/* Top row — back (someone else's profile) / gear (own) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: TOUCH.min, paddingTop: S.md }}>
        {isOwn ? (
          <h1 style={{ ...displayFont, fontSize: T.title, lineHeight: 1.05, color: C.text1, margin: 0 }}>{t("Perfil")}</h1>
        ) : (
          <button onClick={backToMe} style={{ minHeight: TOUCH.min, marginLeft: -10, background: "none", border: "none", color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: S.xs + 2, fontSize: T.body, fontWeight: 700, padding: `0 ${S.sm}px` }}>
            <ArrowLeft size={20} /> {t("Ver o meu")}
          </button>
        )}
        {isOwn && onOpenSettings && (
          <button onClick={onOpenSettings} aria-label={t("Definições")} title={t("Definições")}
            style={{ width: TOUCH.min, height: TOUCH.min, marginRight: -10, background: "none", border: "none", color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Settings size={22} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: `${S.lg}px 0 ${S.xl}px` }}>
        <div style={{ position: "relative", marginBottom: S.md }}>
          <Avatar name={player.name || player.nick} photo={player.photo} color={playerColor(group, player)} size={104} fontSize={38} injured={player.injured} />
          <div title={overallLocked ? `${player.ratingsCount ?? 0}/3 ${t("avaliações")}` : "OVR"} style={{
            position: "absolute", bottom: -6, right: -10, minWidth: 44, height: 30, padding: `0 ${S.sm}px`, boxSizing: "border-box",
            borderRadius: R.pill, background: C.bg, border: `2px solid ${badgeColor}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
          }}>
            <span style={{ ...displayFont, fontSize: 17, color: badgeColor, lineHeight: 1 }}>{overallLocked ? "?" : overall}</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: C.text2, letterSpacing: "0.04em" }}>OVR</span>
          </div>
        </div>
        <div style={{ ...displayFont, fontSize: 28, lineHeight: 1.05, color: C.text1, textTransform: "uppercase", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {player.nick || player.name}
        </div>
        {player.name && player.nick && player.name !== player.nick && (
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>{player.name}</div>
        )}
        <div style={{ fontSize: T.body - 1, color: C.text2, marginTop: S.xs }}>{heroMeta}</div>

        {isOwn && (
          <div style={{ display: "flex", gap: S.sm, marginTop: S.lg, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
            <BtnGhost compact onClick={startEditing} style={{ minHeight: TOUCH.min }}>
              <Pencil size={15} /> {t("Editar perfil")}
            </BtnGhost>
            <Chip variant={player.injured ? "red" : "neutral"} Icon={Cross} onClick={() => onToggleInjured(!player.injured)}>
              {player.injured ? t("Remover lesão") : t("Marcar como lesionado")}
            </Chip>
          </div>
        )}
      </div>

      {/* 4-stat row — one card, tiles inside */}
      <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: S.sm, padding: `${S.lg}px ${S.sm}px`, marginBottom: S.xl }}>
        <StatTile value={gp} label={t("Jogos")} />
        <StatTile value={player.goals ?? 0} label={t("Golos")} />
        <StatTile value={player.assists ?? 0} label={t("Assist.")} />
        <StatTile value={player.mvps ?? 0} label="MVP" />
      </div>

      <SegmentedControl options={SEGMENTS} value={section} onChange={setSection} />

      {section === "resumo" && (
        <>
          {/* FUT card — our personality, stays prominent */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: S.xl }}>
            <FutCard player={player} width={280} ratingsCount={player.ratingsCount} />
          </div>

          {isOwn ? (
            <PeerRatingsCard player={player} cloudMode={cloudMode} onRequest={requestRating} addPeerRating={addPeerRating} />
          ) : (
            cloudMode && onSubmitRating && (
              <div style={{ marginBottom: S.lg }}>
                <RatingForm
                  nick={player.nick}
                  position={player.position}
                  existing={player.myRatingAttrs}
                  onSubmit={(attrs) => onSubmitRating(player.uuid, attrs)}
                />
              </div>
            )
          )}

          {/* Recent form — only when each game's team is known (see formFor) */}
          {form5.length > 0 && (
            <div style={{ marginBottom: S.lg }}>
              <SectionLabel right={<span style={{ fontSize: T.meta, color: C.text2 }}>{t("últimos")} {form5.length} {form5.length === 1 ? t("jogo") : t("jogos")}</span>}>
                {t("Forma recente")}
              </SectionLabel>
              <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.md }}>
                <FormDots results={form5} size={32} />
                <span style={{ fontSize: T.meta, fontWeight: 700, color: C.text2, whiteSpace: "nowrap" }}>
                  {["V", "E", "D"].map((r) => `${form5.filter((x) => x === r).length}${tCtx("form", r)}`).join(" · ")}
                </span>
              </div>
            </div>
          )}

          <CareerSummary
            records={career}
            gaPerGame={perGame((player.goals || 0) + (player.assists || 0))}
            gamesPlayed={gp}
            personalRecords={isOwn ? personalRecords : null}
            attendanceStreak={isOwn ? attendanceStreak : 0}
          />

          {(groupRows.length > 0 || teamRows.length > 0) && (
            <div style={{ marginBottom: S.lg }}>
              <SectionLabel>{teamRows.length ? t("Grupos e equipas") : t("Grupos")}</SectionLabel>
              <div style={{ ...cardStyle, padding: `0 ${S.lg}px` }}>
                {groupRows.map((g, i) => (
                  <ListRow key={`g${g.id}`} divider={i > 0} leading={iconDisc(Users)} title={g.name} meta={g.meta}
                    right={g.active && groupRows.length > 1 ? <Chip variant="green">{t("Ativo")}</Chip> : null} />
                ))}
                {teamRows.map((tm, i) => (
                  <ListRow key={`t${tm.id}`} divider={groupRows.length + i > 0} leading={iconDisc(Shield)} title={tm.name} meta={tm.meta}
                    right={<Chip>{t("Equipa")}</Chip>} />
                ))}
              </div>
            </div>
          )}

          {/* Ban — organizer-only, viewing a teammate's profile. Kept off
              the roster list on purpose (see onRemoveMember there) so this
              stronger, harder-to-undo action isn't a one-tap icon. */}
          {!isOwn && isOrganizer && onBanMember && !player.isGuest && !player.isOrganizerPlayer && (
            <div style={{ marginTop: S.xl }}>
              <SectionLabel style={{ color: C.red }}>{t("BANIR JOGADOR")}</SectionLabel>
              <div style={{ ...cardStyle }}>
                <div style={{ fontSize: T.meta + 1, color: C.text2, marginBottom: S.md, lineHeight: 1.5 }}>
                  {t("Impede")} {player.nick} {t("de voltar a entrar neste grupo, mesmo com um novo convite. Escreve o nick dele para confirmar:")}
                </div>
                <input value={banText} onChange={(e) => setBanText(e.target.value)} placeholder={player.nick}
                  style={{ ...inputStyle, marginBottom: S.md }} />
                <BtnGhost tone="danger" block onClick={submitBan} disabled={!banMatches || banBusy}>
                  {banBusy ? t("A banir…") : t("Banir do grupo")}
                </BtnGhost>
                {banError && <div style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{banError}</div>}
              </div>
            </div>
          )}
        </>
      )}

      {section === "stats" && (
        <>
          <SectionLabel>{t("TEMPORADA")}</SectionLabel>
          <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", rowGap: S.lg, columnGap: S.sm, padding: `${S.lg}px ${S.sm}px`, marginBottom: S.lg }}>
            <StatTile value={`${attendance}%`} label={t("Presença")} color={attendance >= 90 ? C.green : undefined} />
            <StatTile value={perGame((player.goals || 0) + (player.assists || 0))} label={t("G+A / jogo")} />
            <StatTile value={player.wins ?? "—"} label={t("Vitórias")} />
            <StatTile value={perGame(player.goals)} label={t("Golos / jogo")} />
            <StatTile value={perGame(player.assists)} label={t("Assist. / jogo")} />
            <StatTile value={player.cleanSheets ?? 0} label={t("Clean sheets")} />
          </div>

          {isOwn && personalRecords && (
            <>
              <SectionLabel>{t("RESUMO RECENTE")}</SectionLabel>
              <div style={{ ...cardStyle, marginBottom: S.lg, padding: `${S.lg}px ${S.sm}px ${S.md}px` }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: S.sm }}>
                  <StatTile value={personalRecords.gamesInWindow} label={t("Jornadas")} />
                  <StatTile value={personalRecords.totalGoals} label={t("Golos")} />
                  <StatTile value={personalRecords.totalAssists} label={t("Assist.")} />
                  <StatTile value={personalRecords.mvps} label="MVP" />
                </div>
                <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md, textAlign: "center" }}>{t("Todos os teus grupos · últimas jornadas carregadas, não a época inteira.")}</div>
              </div>
            </>
          )}

          <ProgressChart records={days} playerKey={playerKey} />
        </>
      )}

      {section === "conquistas" && <AchievementsSection player={player} ctx={achievementsCtx} />}

      {section === "calendario" && <MatchdayCalendar days={days} playerKey={playerKey} playerNick={player.nick} />}
    </div>
  );
}
