// First-visit welcome per role: what this screen is for, in three lines.
// Shown once on the role's home and dismissed for good (per role, per browser).
// Copy is PT-PT; i18n wraps it at render time.

export const WELCOME = Object.freeze({
  manager: {
    title: "Bem-vindo ao Painel",
    lines: [
      "O Painel mostra o que precisa de ti, do mais urgente ao menos urgente.",
      "O Adjunto responde com os dados da liga e abre o passo certo. Nunca homologa nem decide por ti.",
      "Em Gerir tens as competições, o calendário, as fichas de jogo, a disciplina e o regulamento.",
    ],
  },
  captain: {
    title: "A tua equipa, num só ecrã",
    lines: [
      "Equipa mostra o que precisa de ti: a convocatória, os resultados a rever e os castigos.",
      "Jogos e Classificação cobrem todas as competições da liga.",
      "Em Eu vês o teu cartão e os teus números, ligados aos lances que os geraram.",
    ],
  },
  athlete: {
    title: "Os teus números, ligados ao jogo",
    lines: [
      "Equipa diz-te o próximo jogo e se já estás convocado.",
      "Em Eu vês golos, assistências e forma. Cada número abre o lance que o gerou.",
      "Podes votar no craque dos adeptos depois de cada jogo.",
    ],
  },
  fan: {
    title: "Segue a liga como na bancada",
    lines: [
      "Segue as equipas que quiseres: o próximo jogo aparece logo no Início.",
      "Vota no craque do jogo quando a votação estiver aberta.",
      "Monta a tua equipa de Fantasy com os resultados oficiais.",
    ],
  },
});

export const welcomeFor = (role) => WELCOME[role] || null;

/** Role → seen flag map ({ manager: true, … }). */
export const isWelcomed = (seen, role) => Boolean(seen && seen[role]);

// Lines that only make sense when a module is on (a league that keeps Fantasy or the fan vote off must not advertise them).
const NEEDS = Object.freeze({
  "Vota no craque do jogo quando a votação estiver aberta.": "fan_vote",
  "Monta a tua equipa de Fantasy com os resultados oficiais.": "fantasy",
});
/** The role's welcome lines without the ones about modules that are off. `isOn(moduleId)` → boolean. */
export const welcomeLines = (role, isOn) => (welcomeFor(role)?.lines || []).filter((l) => !NEEDS[l] || isOn(NEEDS[l]));
