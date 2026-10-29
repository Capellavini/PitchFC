// Pitch Manager in Ligas: EN / PT-BR strings (keys = PT-PT source text, see
// i18n.registerStrings — never overrides a shared entry).
import { registerStrings } from "./i18n";

const EN = {
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
  "O mesmo jogo e as mesmas regras dos grupos, com os atletas desta liga. Só pontuam rondas com todos os jogos homologados; corrigir uma súmula recalcula os pontos. Sem dinheiro nem prémios.":
    "O mesmo jogo e as mesmas regras dos grupos, com os atletas deste campeonato. Só pontuam rodadas com todos os jogos homologados; corrigir uma súmula recalcula os pontos. Sem dinheiro nem prêmios.",
  "Equipa guardada (só neste navegador).": "Time salvo (só neste navegador).",
  "Montar equipa": "Montar time",
  "Pitch Manager: {n} titulares e banco, orçamento {b}, capitão ×2 — as mesmas regras do Pitch Manager dos grupos. Só pontuam rondas com todos os jogos homologados.":
    "Pitch Manager: {n} titulares e banco, orçamento {b}, capitão ×2 — as mesmas regras do Pitch Manager dos grupos. Só pontuam rodadas com todos os jogos homologados.",
};

registerStrings("en", EN);
registerStrings("pt-br", PT_BR);
