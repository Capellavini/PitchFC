// PT-PT copy for the league set-up screens (keys are wrapped in t() at render).
export const SETUP_ERROR = Object.freeze({
  name_required: "Indica um nome com pelo menos 2 letras.",
  duplicate_team: "Já existe uma equipa com este nome.",
  not_found: "Não encontrei o que pedes. Atualiza a página e tenta outra vez.",
  has_matches: "Já tem jogos. Só se pode remover o que ainda não tem jogos.",
  team_has_matches: "A equipa já tem jogos nesta competição. Não a podes retirar dela.",
  invalid_line: "Uma das linhas do plantel não tem nome. Corrige e tenta outra vez.",
  nothing_to_add: "Cola pelo menos um atleta, um por linha.",
  duplicate_number: "Esse número já existe no plantel.",
  player_has_history: "O atleta já aparece em convocatórias ou lances e não pode ser removido.",
  calendar_exists: "Esta competição já tem calendário.",
  need_two_teams: "Inscreve pelo menos duas equipas nesta competição.",
  date_required: "Indica a data e a hora.",
  time_required: "Indica pelo menos uma hora de jogo (ex.: 15:00).",
  two_different_teams: "Escolhe duas equipas diferentes.",
  cup_not_scheduled_by_rounds: "As taças montam-se jogo a jogo, em «Adicionar jogo».",
});

export const SETUP_STEP = Object.freeze({
  league: { title: "Dá nome à liga", hint: "Nome e cidade aparecem nas páginas e nas partilhas." },
  competition: { title: "Cria uma competição", hint: "Um campeonato (com voltas) ou uma taça. Podes criar várias." },
  teams: { title: "Inscreve as equipas", hint: "Cada equipa entra nas competições em que joga." },
  players: { title: "Adiciona os atletas", hint: "Cola o plantel: um atleta por linha, com número se quiseres." },
  calendar: { title: "Gera o calendário", hint: "O PITCH monta as jornadas, com folga se o número de equipas for ímpar." },
});
