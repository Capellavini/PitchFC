import { rpc } from "./leagueRolesApi";

/** The league page's server calls: a fan signs up (no account), the Gestor reads and removes sign-ups. */
export const landingApi = Object.freeze({
  signup: (slug, { name, email, teamId = null, consent }) =>
    rpc("league_fan_signup", { p_slug: slug, p_name: name, p_email: email, p_team_id: teamId, p_consent: Boolean(consent) }),
  fans: () => rpc("league_fan_signups_list", {}),
  removeFan: (id) => rpc("league_fan_signup_delete", { p_id: id }),
});

/** Error code → what a person reads (PT-PT source strings; t() is applied by the screen). */
export const SIGNUP_ERROR = Object.freeze({
  consent_required: "Marca a caixa para aceitares que guardemos o teu nome e email.",
  name_required: "Escreve o teu nome.",
  invalid_email: "Esse email não parece certo. Confirma e tenta outra vez.",
  signup_closed: "As inscrições estão fechadas.",
  rate_limited: "Muitas inscrições ao mesmo tempo. Tenta outra vez daqui a uns minutos.",
  signup_full: "As inscrições estão cheias.",
  not_found: "Esta liga já não aceita inscrições.",
  network: "Sem ligação. Confirma a internet e tenta outra vez.",
});
export const signupErrorText = (code) => SIGNUP_ERROR[code] || "Não foi possível inscrever-te. Tenta outra vez.";
