// Pitch Manager in Ligas: EN / PT-BR strings (keys = PT-PT source text, see
// i18n.registerStrings — never overrides a shared entry).
import { registerStrings } from "./i18n";

const EN = {
  "A abrir o Pitch Manager…": "Opening Pitch Manager…",
  "Não conseguimos abrir o Pitch Manager. Verifica a ligação e tenta outra vez.": "We couldn't open Pitch Manager. Check your connection and try again.",
  "Ainda não disponível nas ligas.": "Not available in leagues yet.",
  "A equipa não é válida. Confirma os titulares, o banco e o capitão.": "The squad isn't valid. Check the starters, the bench and the captain.",
  "Um dos atletas já não está na liga. Atualiza a página e tenta outra vez.": "One of the athletes is no longer in the league. Refresh the page and try again.",
  "A conexão tem de ser entre dois titulares diferentes.": "The Conexão must link two different starters.",
  "O Pitch Manager está desligado nesta liga.": "Pitch Manager is switched off in this league.",
  "Não tens acesso ao Pitch Manager desta liga.": "You don't have access to this league's Pitch Manager.",
  "Entra na tua conta para jogar.": "Sign in to play.",
  "Sem ligação. Confirma a internet e tenta outra vez.": "No connection. Check your internet and try again.",
  "O Pitch Manager ainda não está ativo nesta liga.": "Pitch Manager isn't active in this league yet.",
  "Não foi possível guardar. Tenta outra vez.": "Couldn't save. Try again.",
  "Gestor": "Manager",
  "Pitch Manager da liga": "The league's Pitch Manager",
  "A tua equipa tem {n} pontos · {r}.º de {m}": "Your squad has {n} points · #{r} of {m}",
  "A tua equipa tem {n} pontos": "Your squad has {n} points",
  "Monta a tua equipa e soma pontos com os jogos oficiais.": "Build your squad and earn points from the official matches.",
  "Pitch Manager · demonstração": "Pitch Manager · demo",
  "O mesmo jogo e as mesmas regras dos grupos, com os atletas desta liga. Só pontuam rondas com todos os jogos homologados; corrigir uma súmula recalcula os pontos. Sem dinheiro nem prémios.":
    "The same game and rules as the groups, with this league's athletes. Only rounds with every match homologated score; correcting a match sheet recalculates the points. No money, no prizes.",
  "Equipa guardada (só neste navegador).": "Squad saved (this browser only).",
  "O Pitch Manager precisa de mais atletas inscritos na liga para poderes montar uma equipa.": "Pitch Manager needs more athletes registered in the league before you can build a squad.",
  "Montar equipa": "Build your squad",
  "Pitch Manager: {n} titulares e banco, orçamento {b}, capitão ×2 — as mesmas regras do Pitch Manager dos grupos. Só pontuam rondas com todos os jogos homologados.":
    "Pitch Manager: {n} starters and a bench, budget {b}, captain ×2 — the same rules as the groups' Pitch Manager. Only rounds with every match homologated score.",
  "Não altera o craque oficial nem pontua no Pitch Manager.": "It doesn't change the official player of the match nor score in Pitch Manager.",
};

const PT_BR = {
  "A abrir o Pitch Manager…": "Abrindo o Pitch Manager…",
  "Não conseguimos abrir o Pitch Manager. Verifica a ligação e tenta outra vez.": "Não conseguimos abrir o Pitch Manager. Verifique a conexão e tente de novo.",
  "Ainda não disponível nas ligas.": "Ainda não disponível nos campeonatos.",
  "A equipa não é válida. Confirma os titulares, o banco e o capitão.": "O time não é válido. Confira os titulares, o banco e o capitão.",
  "Um dos atletas já não está na liga. Atualiza a página e tenta outra vez.": "Um dos atletas não está mais no campeonato. Atualize a página e tente de novo.",
  "A conexão tem de ser entre dois titulares diferentes.": "A conexão precisa ser entre dois titulares diferentes.",
  "O Pitch Manager está desligado nesta liga.": "O Pitch Manager está desligado neste campeonato.",
  "Não tens acesso ao Pitch Manager desta liga.": "Você não tem acesso ao Pitch Manager deste campeonato.",
  "Entra na tua conta para jogar.": "Entre na sua conta para jogar.",
  "O Pitch Manager ainda não está ativo nesta liga.": "O Pitch Manager ainda não está ativo neste campeonato.",
  "Não foi possível guardar. Tenta outra vez.": "Não foi possível salvar. Tente de novo.",
  "Pitch Manager da liga": "Pitch Manager do campeonato",
  "A tua equipa tem {n} pontos · {r}.º de {m}": "O seu time tem {n} pontos · {r}º de {m}",
  "Monta a tua equipa e soma pontos com os jogos oficiais.": "Monte o seu time e some pontos com os jogos oficiais.",
  "O mesmo jogo e as mesmas regras dos grupos, com os atletas desta liga. Só pontuam rondas com todos os jogos homologados; corrigir uma súmula recalcula os pontos. Sem dinheiro nem prémios.":
    "O mesmo jogo e as mesmas regras dos grupos, com os atletas deste campeonato. Só pontuam rodadas com todos os jogos homologados; corrigir uma súmula recalcula os pontos. Sem dinheiro nem prêmios.",
  "Equipa guardada (só neste navegador).": "Time salvo (só neste navegador).",
  "Montar equipa": "Montar time",
  "Pitch Manager: {n} titulares e banco, orçamento {b}, capitão ×2 — as mesmas regras do Pitch Manager dos grupos. Só pontuam rondas com todos os jogos homologados.":
    "Pitch Manager: {n} titulares e banco, orçamento {b}, capitão ×2 — as mesmas regras do Pitch Manager dos grupos. Só pontuam rodadas com todos os jogos homologados.",
};

registerStrings("en", EN);
registerStrings("pt-br", PT_BR);
