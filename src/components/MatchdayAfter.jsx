import { useState } from "react";
import { Share2, Check, CalendarPlus, Video } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { playerColor } from "../lib/helpers";
import Avatar from "./Avatar";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";
import FeedComposer from "./FeedComposer";
import ListRow from "./ListRow";
import MatchdayGames from "./MatchdayGames";
import MatchdayMvpVote from "./MatchdayMvpVote";
import PostMatchCardModal from "./PostMatchCard";
import ScoreBlock from "./ScoreBlock";
import SectionLabel from "./SectionLabel";
import StatTile from "./StatTile";

/**
 * Matchday state C — after the final whistle. Reads the saved day summary
 * (lastMatchday: { date, mode, teamResults, matches, lines, candidates })
 * and the MVP view object. Final score (ScoreBlock for a one-game night,
 * a tappable results list otherwise), who scored/assisted, MVP vote or
 * podium, the personal share card (PostMatchCard) and the Golo da Semana
 * entry point: opens the feed's post composer (FeedComposer) — a group
 * video post is what Golo da Semana ranks, so no separate backend.
 */
export default function MatchdayAfter({ lastMatchday, mvp, me, group, groupName, onCardGenerated, canManage, onPrepareNext, social }) {
  const [showCard, setShowCard] = useState(false);
  const [gotwOpen, setGotwOpen] = useState(false);
  const [gotwSent, setGotwSent] = useState(false);
  const md = lastMatchday || {};
  const matches = (md.matches || []).filter((m) => m && m.homeName != null);
  const teamColor = (name) => (md.teamResults || []).find((tr) => tr.name === name)?.color;
  const totalGoals = matches.reduce((s, m) => s + (m.homeGoals || 0) + (m.awayGoals || 0), 0);
  const lines = (md.lines || []).filter((l) => l.goals || l.assists || l.cleanSheets || l.epicSaves);
  const myKey = me ? (me.uuid ?? me.id) : null;
  const iPlayed = myKey != null && ((md.lines || []).some((l) => l.key === myKey) || (md.candidates || []).some((c) => c.key === myKey));
  const isMVP = Boolean(me) && mvp?.podium?.first === me.nick;
  const playerOf = (l) => group.find((p) => (p.uuid ?? p.id) === l.key);
  const colorFor = (l) => l.color || (playerOf(l) ? playerColor(group, playerOf(l)) : C.blue);
  const bestTeam = [...(md.teamResults || [])].sort((a, b) => (b.wins || 0) - (a.wins || 0))[0];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.lg, flexWrap: "wrap" }}>
        <Chip variant="green" Icon={Check}>{t("Terminado")}</Chip>
        {md.date && <Chip>{md.date}</Chip>}
      </div>

      {/* final score */}
      {matches.length === 1 ? (
        <ScoreBlock
          home={{ name: matches[0].homeName, score: matches[0].homeGoals, color: teamColor(matches[0].homeName) }}
          away={{ name: matches[0].awayName, score: matches[0].awayGoals, color: teamColor(matches[0].awayName) }}
          center={<span style={{ color: C.green }}>{t("FINAL")}</span>}
          style={{ marginBottom: S.xl }}
        />
      ) : matches.length > 1 ? (
        <section style={{ marginBottom: S.xl }}>
          {/* alignItems end → the three labels share a baseline even when the
              team name wraps to 2 lines (long names like "Sem coletes"). */}
          <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: S.sm, alignItems: "end", marginBottom: S.md }}>
            <StatTile value={matches.length} label={t("Jogos")} />
            <StatTile value={totalGoals} label={t("Golos")} />
            <StatTile value={bestTeam?.wins
              ? <span style={{ display: "block", fontSize: (bestTeam.name || "").length > 8 ? T.cardTitle : T.h, lineHeight: 1.1, textTransform: "uppercase", overflowWrap: "anywhere", hyphens: "auto" }}>{bestTeam.name}</span>
              : "—"} label={t("Mais vitórias")} color={bestTeam?.wins ? (bestTeam.color || C.text1) : C.text2} />
          </div>
          <MatchdayGames summary={md} framed />
        </section>
      ) : null}

      {/* goals & assists */}
      {lines.length > 0 && (
        <section style={{ marginBottom: S.xl }}>
          <SectionLabel>{t("Golos e assistências")}</SectionLabel>
          <div style={{ ...cardStyle, padding: `0 ${S.lg}px` }}>
            {lines.map((l, i) => (
              <ListRow key={l.key ?? i} divider={i > 0}
                leading={<Avatar name={playerOf(l)?.name || l.nick} color={colorFor(l)} photo={l.photo || playerOf(l)?.photo} isMe={l.isMe || l.key === myKey} size={36} />}
                title={l.nick}
                meta={[
                  l.assists ? `${l.assists} ${t("assist.")}` : null,
                  l.cleanSheets ? `${l.cleanSheets} ${l.cleanSheets === 1 ? t("baliza a zero") : t("balizas a zero")}` : null,
                  l.epicSaves ? `${l.epicSaves} ${l.epicSaves === 1 ? t("defesa") : t("defesas")}` : null,
                ].filter(Boolean).join(" · ") || null}
                right={l.goals ? <span style={{ fontSize: T.h, fontWeight: 900, fontStyle: "italic" }}>⚽ {l.goals}</span> : null} />
            ))}
          </div>
        </section>
      )}

      <MatchdayMvpVote mvp={mvp} />

      {/* share + Golo da Semana */}
      {iPlayed && me && (
        <section style={{ marginBottom: S.xl }}>
          <SectionLabel>{t("Partilhar")}</SectionLabel>
          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: T.cardTitle, fontWeight: 700 }}>{t("O teu card do jogo")}</div>
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, marginBottom: S.md }}>{t("Os teus golos e assistências, pronto para o WhatsApp e Instagram.")}</div>
            <BtnPrimary block onClick={() => setShowCard(true)}><Share2 size={16} /> {t("Gerar o meu card")}</BtnPrimary>
            {social && !gotwOpen && (
              <BtnGhost block onClick={() => { setGotwOpen(true); setGotwSent(false); }} style={{ marginTop: S.sm }}>
                <Video size={16} /> {t("Submeter ao Golo da Semana")}
              </BtnGhost>
            )}
            {gotwSent && !gotwOpen && (
              <div style={{ fontSize: T.meta, color: C.green, marginTop: S.sm, display: "flex", alignItems: "center", gap: S.xs }}>
                <Check size={14} /> {t("Publicado no feed — o vídeo com mais ⚽ Golaço ganha.")}
              </div>
            )}
          </div>
          {social && gotwOpen && (
            // Same composer as Home's feed: a video post from the group
            // enters Golo da Semana automatically (Competir ranks them).
            <div style={{ marginTop: S.md }}>
              <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{t("Escolhe \"Vídeo\" e publica o teu golo. Os vídeos do grupo dos últimos 7 dias entram no Golo da Semana.")}</div>
              <FeedComposer me={me} social={social} initialOpen placeholder={t("Descreve o golo…")}
                onPublished={() => { setGotwOpen(false); setGotwSent(true); }} style={{ marginBottom: 0 }} />
              <BtnGhost block onClick={() => setGotwOpen(false)} style={{ marginTop: S.sm }}>{t("Cancelar")}</BtnGhost>
            </div>
          )}
        </section>
      )}

      {canManage && onPrepareNext && (
        <BtnGhost block onClick={onPrepareNext} style={{ marginBottom: S.xl }}>
          <CalendarPlus size={16} /> {t("Preparar o próximo jogo")}
        </BtnGhost>
      )}

      {showCard && me && (
        <PostMatchCardModal player={me} group={group} matchday={md} groupName={groupName} isMVP={isMVP} onClose={() => setShowCard(false)} onGenerated={onCardGenerated} />
      )}
    </div>
  );
}
