// PITCH Ligas — papéis (capitão, atleta). Pure helpers: invite links, the
// message the Gestor shares, how invites and members group per team, and the
// copy for every server error. The server (league_invite_* / league_member_*)
// decides what anyone may do; nothing here grants access.

export const ROLE_LABEL = Object.freeze({ captain: "Capitão", athlete: "Atleta" });

const TOKEN_RE = /^\/l\/convite\/([a-f0-9]{40})\/?$/;

/** The token of an invite page path (/l/convite/<token>), or null. */
export const inviteTokenFromPath = (path) => TOKEN_RE.exec(String(path || ""))?.[1] ?? null;

export const invitePath = (token) => `/l/convite/${token}`;

/** Where the sign-in page should send the person afterwards: only ever an invite page
 *  (?next=/l/convite/<token>), never an arbitrary address. */
export const inviteNextFromSearch = (search) => {
  const next = new URLSearchParams(String(search || "")).get("next");
  return inviteTokenFromPath(next) ? next.replace(/\/+$/, "") : null;
};

// A member's home (any signed-in account): the list of leagues, and one league as that member sees it.
export const MEMBER_HOME_PATH = "/league/minhas/acesso";
export const memberPath = (workspaceId) => `${MEMBER_HOME_PATH}/${workspaceId}`;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const memberWorkspaceFromPath = (path) => new RegExp(`^${MEMBER_HOME_PATH}/(${UUID})/?$`).exec(String(path || ""))?.[1] ?? null;

/** What a person who belongs to leagues sees first: one entry per league they manage or belong to.
 *  owner: does this account have its own league · memberships: league_my_memberships rows. */
export function homeEntries({ owner = false, memberships = [] }) {
  const list = [];
  if (owner) list.push({ key: "owner", kind: "owner", title: "A minha liga", detail: "Gestor", href: "/league/minhas/painel" });
  for (const m of memberships) {
    list.push({
      key: `${m.workspace_id}:${m.role}:${m.team_id}`, kind: m.role, title: m.league_name || "Liga",
      detail: `${ROLE_LABEL[m.role] || m.role} · ${m.team_name || ""}`.replace(/ · $/, ""), href: memberPath(m.workspace_id),
    });
  }
  return list;
}
export const inviteUrl = (token, origin = "") => `${String(origin).replace(/\/+$/, "")}${invitePath(token)}`;

/** The WhatsApp message the Gestor sends with the link. */
export function inviteMessage({ league, role, team, url }) {
  const where = league ? ` da ${league}` : "";
  if (role === "captain") return `Olá! Foste convidado para ser capitão da equipa ${team}${where}. Entra aqui para gerir o plantel: ${url}`;
  return `Olá! Convidámos-te para a equipa ${team}${where}. Entra aqui para veres os jogos e o teu registo: ${url}`;
}
export const whatsappShareUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** PT-PT copy for the error codes of the roles RPCs. */
export const ROLE_ERROR = Object.freeze({
  not_authenticated: "Precisas de entrar na tua conta.",
  forbidden: "Não tens permissão para isto.",
  not_found: "Não encontrámos isso. Atualiza a página.",
  invalid_invite: "Este convite não é válido ou já expirou. Pede um novo ao gestor da liga.",
  invite_used: "Este convite já foi usado. Pede um novo ao gestor da liga.",
  player_taken: "Este lugar no plantel já tem dono. Pede ao gestor um convite novo.",
  owner_cannot_join: "Esta é a tua própria liga: não precisas de convite.",
  team_not_found: "Esta equipa já não existe na liga.",
  player_not_found: "Este atleta já não está no plantel.",
  invalid_role: "Este tipo de convite não existe.",
  too_many_invites: "Há convites a mais abertos. Revoga alguns antes de criar outros.",
  name_required: "Cada atleta precisa de um nome.",
  invalid_number: "O número tem de estar entre 0 e 99.",
  duplicate_number: "Dois atletas têm o mesmo número.",
  duplicate_player: "Há um atleta repetido.",
  invalid_player: "Este atleta não pertence à tua equipa.",
  invalid_squad: "Não foi possível ler o plantel.",
  squad_too_large: "O plantel pode ter no máximo 40 atletas.",
  player_has_history: "Este atleta tem jogos ou lances registados e não pode ser removido. Fala com o gestor.",
  already_claimed: "Já escolheste quem és no plantel. Para mudar, fala com o gestor.",
});
export const roleErrorText = (code) => ROLE_ERROR[code] || "Não foi possível concluir. Tenta outra vez.";

/** Per team: who is captain, who are the athletes, and which invites are still open.
 *  invites: league_invites_list rows · members: league_members_list rows. */
export function accessByTeam({ teams = [], invites = [], members = [] }) {
  return teams.map((team) => {
    const mine = (r) => r.team_id === team.id;
    const open = invites.filter((i) => mine(i) && i.status === "open");
    return {
      team,
      captains: members.filter((m) => mine(m) && m.role === "captain"),
      athletes: members.filter((m) => mine(m) && m.role === "athlete"),
      captainInvites: open.filter((i) => i.role === "captain"),
      teamInvite: open.find((i) => i.role === "athlete" && !i.player_id) ?? null,
      playerInvites: open.filter((i) => i.role === "athlete" && i.player_id),
    };
  });
}

/** Short sentence for an open invite: "1 de 60 usados · expira em 12 dias". */
export function inviteUsage(invite, now = Date.now()) {
  const days = Math.max(0, Math.ceil((Date.parse(invite.expires_at) - now) / 86400000));
  return `${invite.uses} de ${invite.max_uses} ${invite.uses === 1 ? "usado" : "usados"} · ${days === 1 ? "expira em 1 dia" : `expira em ${days} dias`}`;
}
