import { useMemo, useState } from "react";
import { CheckCircle2, Link2 } from "lucide-react";
import { C, R, S, T, TOUCH, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC, RC, rivalsError, tf } from "../lib/rivalsCopy";
import { TEAM_FORMATS, isLeader } from "../lib/rivals";
import {
  COST_SPLITS, DURATIONS, defaultTerms, diffTerms, newClientRef, normTerms, parseCost, rematchDraft, responseDeadline,
  validateTerms, zonedParts, zonedToIso,
} from "../lib/rivalsChallenges";
import { kickoffLabel, splitLabel, termValue, tzCity } from "../lib/challengeLabels";
import { SC } from "../lib/rivalsShareCopy";
import Sheet from "./Sheet";
import FormField from "./FormField";
import OptionPills from "./OptionPills";
import OpponentPicker from "./OpponentPicker";
import TeamBadge from "./TeamBadge";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import ChallengeShareActions from "./ChallengeShareActions";

/**
 * Propose / counter / change the terms of a team challenge.
 *  mode "new"     → createChallenge: from one of MY led teams to `opponent`
 *                   (directed) or to nobody (claimable "Criar link de
 *                   desafio"); ends on a share screen (WhatsApp + copy).
 *  mode "counter" → counterChallenge on base.challengeId / base.baseVersion.
 *  mode "change"  → proposeMatchChange on base.matchId (after agreement).
 *  mode "rematch" → createRematch: `base` = { match, myTeam, opponent }; my team
 *                   challenges the other one with the same terms (sides flipped
 *                   when I was away) and a suggested new date; ends on the same
 *                   share screen as "new".
 * `base` (counter/change) = { challengeId, matchId, baseVersion, terms,
 *   challenger, challenged, mySide, asTeamId, token }.
 * Date + time are typed in the team's timezone. Cost is informational
 * only (PITCH never books or charges). onDone(result) after success.
 */
export default function ChallengeComposer({ teams, mode = "new", fromTeamId, opponent: opponentProp = null, openLink = false, base, onClose, onDone }) {
  const isRematch = mode === "rematch";
  const leaderTeams = teams.myTeams.filter((tm) => isLeader(tm.role));
  const [fromId, setFromId] = useState(isRematch ? base.myTeam.id : fromTeamId && leaderTeams.some((x) => x.id === fromTeamId) ? fromTeamId : leaderTeams[0]?.id || "");
  const fromTeam = isRematch ? base.myTeam : leaderTeams.find((x) => x.id === fromId) || null;
  const [opponent, setOpponent] = useState(isRematch ? base.opponent : opponentProp);
  const [linkMode, setLinkMode] = useState(Boolean(openLink && !opponentProp && !isRematch));
  // "creating" = a brand-new challenge (new, or a rematch — which is one too); counter/change edit an existing one.
  const isNew = mode === "new" || isRematch;
  const mySide = isNew ? "challenger" : base?.mySide || "challenger";

  const start = useMemo(() => {
    if (isRematch) return rematchDraft(base.match, base.myTeam.id);
    if (!isNew) return normTerms(base.terms);
    const d = defaultTerms(fromTeam);
    const { date } = zonedParts(new Date(Date.now() + 7 * 864e5).toISOString(), d.timezone);
    return { ...d, kickoffAt: zonedToIso(date, "20:00", d.timezone) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tz = isRematch ? start.timezone : isNew ? fromTeam?.timezone || start.timezone : start.timezone;
  const currency = isRematch ? start.currency : isNew ? fromTeam?.currency || start.currency : start.currency;
  const startParts = zonedParts(start.kickoffAt, tz);

  const [f, setF] = useState({
    date: startParts.date, time: startParts.time, venueName: start.venueName || "", venueAddress: start.venueAddress || "",
    fieldResponsible: start.fieldResponsible, durationMin: start.durationMin, format: start.format,
    cost: start.costCents == null ? "" : String(start.costCents / 100).replace(".", ","), costSplit: start.costSplit, note: start.note || "",
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v && v.target ? v.target.value : v }));
  const [clientRef] = useState(newClientRef);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  const costCents = parseCost(f.cost);
  const terms = {
    kickoffAt: zonedToIso(f.date, f.time, tz), timezone: tz, format: f.format, durationMin: Number(f.durationMin),
    venueName: f.venueName.trim() || null, venueAddress: f.venueAddress.trim() || null, venueUrl: isNew && !isRematch ? null : start.venueUrl,
    fieldResponsible: f.fieldResponsible, costCents: Number.isNaN(costCents) ? null : costCents, currency,
    costSplit: f.costSplit, note: f.note.trim() || null,
  };
  const changed = isNew ? [] : diffTerms(normTerms(base.terms), terms).filter((k) => k !== "venueUrl");
  const kickOk = Number.isFinite(Date.parse(terms.kickoffAt));
  const sideTeams = isNew
    ? { challenger: fromTeam, challenged: linkMode ? null : opponent }
    : { challenger: base.challenger, challenged: base.challenged };

  const submit = async () => {
    setError(null);
    if (Number.isNaN(costCents)) { setError(rivalsError("invalid_cost")); return; }
    if (isNew && !fromTeam) { setError(rivalsError("not_team_leader")); return; }
    if (isNew && !linkMode && !opponent) { setError(t(CC.pickOpponentFirst)); return; }
    const bad = validateTerms(terms);
    if (bad) { setError(rivalsError(bad)); return; }
    if (!isNew && !changed.length) { setError(rivalsError("no_changes")); return; }
    setBusy(true);
    let r;
    if (isRematch) r = await teams.createRematch({ matchId: base.match.id, terms, clientRef });
    else if (isNew) r = await teams.createChallenge({ fromTeamId: fromTeam.id, toTeamId: linkMode ? null : opponent.id, terms, clientRef });
    else if (mode === "counter") r = await teams.counterChallenge(base.challengeId, base.baseVersion, terms, { asTeamId: base.asTeamId, token: base.token });
    else r = await teams.proposeMatchChange(base.matchId, base.baseVersion, terms, { asTeamId: base.asTeamId });
    setBusy(false);
    if (r.error) { setError(rivalsError(r.error)); return; }
    if (isNew) setSent(r.data); else onDone?.(r.data);
  };

  if (sent) {
    const when = kickoffLabel(terms.kickoffAt, tz);
    const venue = termValue("venueName", terms);
    const message = linkMode
      ? tf(CC.openLinkMessage, { team: fromTeam.name, when, venue, url: sent.url })
      : tf(CC.challengeMessage, { team: fromTeam.name, when, venue, url: sent.url });
    return (
      <Sheet title={t(linkMode ? CC.linkCreated : CC.sentTitle)} onClose={() => onDone?.(sent)}>
        <div role="status" style={{ textAlign: "center", padding: `${S.sm}px 0 ${S.md}px` }}>
          <CheckCircle2 size={40} color={C.green} aria-hidden />
          <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, marginTop: S.sm }}>
            {fromTeam.name} vs {linkMode ? t(CC.anyTeam) : opponent.name}
          </div>
          <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: S.xs }}>{when} · {venue}</div>
          <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: S.md, lineHeight: 1.5 }}>
            {linkMode ? t(CC.linkBody) : tf(CC.sentBody, { team: opponent.name })}
          </div>
        </div>
        <ChallengeShareActions url={sent.url} message={message} />
        <BtnGhost block onClick={() => onDone?.(sent)} style={{ marginTop: S.sm }}>{t(CC.openChallenge)}</BtnGhost>
      </Sheet>
    );
  }

  const title = t(isRematch ? SC.rematchTitle : mode === "counter" ? CC.composerCounter : mode === "change" ? CC.composerChange : CC.composerNew);
  const cta = busy ? t(CC.sending) : t(isRematch ? SC.rematchSend : mode === "counter" ? CC.sendCounter : mode === "change" ? CC.sendChange : linkMode ? CC.createLink : CC.send);
  const sideLabel = (side) => t(side === mySide ? CC.us : CC.them);
  const mark = (k) => (changed.includes(k) ? ` · ${t(CC.changed)}` : "");

  return (
    <Sheet title={title} onClose={onClose} footer={(
      <>
        {error && <div role="alert" style={{ color: C.red, fontSize: T.meta + 0.5, marginBottom: S.sm }}>{error}</div>}
        {!isNew && changed.length > 0 && (
          <div aria-live="polite" style={{ fontSize: T.meta, color: C.accent, fontWeight: 700, marginBottom: S.sm }}>{tf(CC.changedFromCurrent, { n: changed.length })}</div>
        )}
        <BtnPrimary block onClick={submit} disabled={busy || (isNew && !fromTeam)}>{cta}</BtnPrimary>
      </>
    )}>
      {isRematch && <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>{t(SC.rematchHint)}</div>}

      {isNew && !isRematch && leaderTeams.length > 1 && (
        <FormField label={t(CC.yourTeam)}>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} style={inputStyle()}>
            {leaderTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
          </select>
        </FormField>
      )}

      {isNew && (
        <FormField group label={t(CC.opponent)}>
          {linkMode ? (
            <div style={{ display: "flex", alignItems: "center", gap: S.md, background: C.card, border: `1px solid ${C.accentBorder}`, borderRadius: R.control, padding: `${S.sm}px ${S.sm}px ${S.sm}px ${S.md}px` }}>
              <Link2 size={20} color={C.accent} aria-hidden />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1 }}>{t(CC.openLinkOption)}</div>
                <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.4 }}>{t(CC.openLinkHint)}</div>
              </div>
              <button type="button" onClick={() => setLinkMode(false)} style={{ minHeight: TOUCH.min, minWidth: TOUCH.min, background: "none", border: "none", color: C.accent, fontWeight: 700, fontSize: T.meta + 1, cursor: "pointer" }}>{t(CC.change)}</button>
            </div>
          ) : opponent ? (
            <div style={{ display: "flex", alignItems: "center", gap: S.md, background: C.card, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `${S.sm}px ${S.sm}px ${S.sm}px ${S.md}px` }}>
              <TeamBadge team={opponent} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opponent.name}</div>
                <div style={{ fontSize: T.meta, color: C.text2 }}>{[opponent.city || opponent.region, opponent.format].filter(Boolean).join(" · ")}</div>
              </div>
              {!opponentProp && !isRematch && (
                <button type="button" onClick={() => setOpponent(null)} style={{ minHeight: TOUCH.min, minWidth: TOUCH.min, background: "none", border: "none", color: C.accent, fontWeight: 700, fontSize: T.meta + 1, cursor: "pointer" }}>{t(CC.change)}</button>
              )}
            </div>
          ) : (
            <>
              <OpponentPicker teams={teams} country={fromTeam?.country || "PT"} city={fromTeam?.city}
                exclude={teams.myTeams.map((x) => x.id)} onPick={setOpponent} />
              <BtnGhost tone="accent" block onClick={() => setLinkMode(true)} style={{ marginTop: S.sm }}>
                <Link2 size={16} aria-hidden /> {t(CC.openLinkOption)}
              </BtnGhost>
            </>
          )}
        </FormField>
      )}

      <div style={{ display: "flex", gap: S.sm }}>
        <FormField label={`${t(CC.date)}${mark("kickoffAt")}`} style={{ flex: 1.3 }}>
          <input type="date" value={f.date} onChange={set("date")} style={inputStyle()} />
        </FormField>
        <FormField label={t(CC.time)} hint={tf(CC.timeIn, { tz: tzCity(tz) })} style={{ flex: 1 }}>
          <input type="time" value={f.time} onChange={set("time")} style={inputStyle()} />
        </FormField>
      </div>
      {kickOk && (
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: -S.xs, marginBottom: S.md, lineHeight: 1.4 }}>
          {Date.parse(terms.kickoffAt) - Date.now() < 3 * 3600e3 ? t(CC.minLeadHint) : tf(CC.deadlineHint, { when: kickoffLabel(responseDeadline(terms.kickoffAt), tz) })}
        </div>
      )}

      <FormField label={`${t(CC.venue)}${mark("venueName")}`}>
        <input value={f.venueName} onChange={set("venueName")} maxLength={80} placeholder={t(CC.venuePlaceholder)} style={inputStyle()} />
      </FormField>
      <FormField label={`${t(CC.address)}${mark("venueAddress")}`}>
        <input value={f.venueAddress} onChange={set("venueAddress")} maxLength={120} style={inputStyle()} />
      </FormField>
      <FormField group label={`${t(CC.fieldResponsible)}${mark("fieldResponsible")}`}>
        <OptionPills label={t(CC.fieldResponsible)} value={f.fieldResponsible} onChange={set("fieldResponsible")}
          options={["challenger", "challenged"].map((id) => ({ id, label: `${sideLabel(id)}${sideTeams[id]?.name ? ` · ${sideTeams[id].name}` : ""}` }))} />
      </FormField>
      <FormField group label={`${t(RC.format)}${mark("format")}`}>
        <OptionPills label={t(RC.format)} value={f.format} onChange={set("format")} options={TEAM_FORMATS.map((x) => ({ id: x, label: x }))} />
      </FormField>
      <FormField group label={`${t(CC.duration)}${mark("durationMin")}`}>
        <OptionPills label={t(CC.duration)} value={Number(f.durationMin)} onChange={set("durationMin")}
          options={DURATIONS.map((n) => ({ id: n, label: tf(CC.minutes, { n }) }))} />
      </FormField>
      <div style={{ display: "flex", gap: S.sm }}>
        <FormField label={`${tf(CC.cost, { cur: currency })}${mark("costCents")}`} style={{ flex: 1 }}>
          <input inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder={t(CC.costPlaceholder)} style={inputStyle()} />
        </FormField>
      </div>
      <FormField group label={`${t(CC.costSplit)}${mark("costSplit")}`} hint={t(CC.costDisclaimer)}>
        <OptionPills label={t(CC.costSplit)} value={f.costSplit} onChange={set("costSplit")} options={COST_SPLITS.map((id) => ({ id, label: splitLabel(id) }))} />
      </FormField>
      <FormField label={`${t(CC.note)}${mark("note")}`} hint={`${f.note.length}/280`}>
        <textarea value={f.note} onChange={set("note")} maxLength={280} rows={2} placeholder={t(CC.notePlaceholder)} style={{ ...inputStyle(), resize: "vertical" }} />
      </FormField>
    </Sheet>
  );
}
