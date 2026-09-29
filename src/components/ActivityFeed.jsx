import { useState } from "react";
import { UserPlus, Activity } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import SectionLabel from "./SectionLabel";
import Chip from "./Chip";
import FeedComposer from "./FeedComposer";
import FeedItem from "./FeedItem";
import FriendsPanel from "./FriendsPanel";

/**
 * ActivityFeed — Home §3: ONE chronological feed of my groups + friends
 * (no For you / Following / Near you filters). Auto-generated football
 * items and manual posts share the same card anatomy.
 *
 * Props:
 *  - items          buildFeed() output (lib/homeFeed).
 *  - social         normalized social object from PitchApp (post + friend handlers).
 *  - me             current player (composer avatar).
 *  - kudosFor(item) → { count, mine } for performance items.
 *  - onGolaco(item) toggles the ⚽ Golaço on a performance item.
 *  - friendsEnabled show the Amigos manager (cloud only).
 *  - onWorkout      opens the workout card composer (optional).
 *  - onOpenGotw     opens Competir (Golo da Semana ranking) from the leader item.
 *  - onOpenCompetir opens Competir from a podium item.
 */
const GOLACO_KINDS = ["performance", "achievement", "legend"];

export default function ActivityFeed({ items = [], social, me, kudosFor, onGolaco, friendsEnabled, onWorkout, onOpenGotw, onOpenCompetir, nameOf }) {
  const requests = social?.requests?.length || 0;
  const [friendsOpen, setFriendsOpen] = useState(false);

  return (
    <section style={{ marginBottom: S.xl }}>
      <SectionLabel right={friendsEnabled ? (
        <Chip onClick={() => setFriendsOpen((v) => !v)} Icon={UserPlus} variant={requests ? "lime" : "neutral"}>
          {requests ? `${requests} ${requests === 1 ? t("pedido") : t("pedidos")}` : t("Amigos")}
        </Chip>
      ) : null} style={{ marginBottom: friendsEnabled ? S.xs : S.md }}>
        {t("Atividade")}
      </SectionLabel>

      {friendsEnabled && friendsOpen && <FriendsPanel social={social} adding />}

      {social && <FeedComposer me={me} social={social} onWorkout={onWorkout} />}

      {items.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: `${S.xl}px ${S.lg}px` }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", margin: `0 auto ${S.md}px`, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Activity size={22} color={C.text2} />
          </div>
          <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, marginBottom: S.xs }}>{t("A atividade começa no primeiro jogo")}</div>
          <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.5 }}>
            {t("Resultados, golos, MVPs e recordes do teu grupo e dos teus amigos aparecem aqui automaticamente.")}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: S.md }}>
          {items.map((item) => (
            <FeedItem key={item.id} item={item} social={social}
              kudos={GOLACO_KINDS.includes(item.kind) && kudosFor ? kudosFor(item) : undefined}
              onGolaco={GOLACO_KINDS.includes(item.kind) && onGolaco ? () => onGolaco(item) : undefined}
              onOpenGotw={onOpenGotw} onOpenCompetir={onOpenCompetir} nameOf={nameOf} />
          ))}
        </div>
      )}
    </section>
  );
}
