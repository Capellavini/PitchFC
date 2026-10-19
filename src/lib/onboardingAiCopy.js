// User-facing copy for the organizer's guided AI onboarding. Same
// convention as rivalsCopy.js: the PT-PT string IS the key; L(pt, en, ptBr)
// registers EN and PT-BR with the shared i18n. Render with t(OA.x) and fill
// {placeholders} with tf().
import { registerStrings, t } from "./i18n.js";

const EN = {};
const BR = {};
const L = (pt, en, ptBr) => {
  EN[pt] = en;
  if (ptBr !== undefined) BR[pt] = ptBr;
  return pt;
};
export const tf = (key, vars = {}) => String(t(key)).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

export const OA = {
  title: L("Vamos montar o teu jogo", "Let's set up your game", "Vamos montar o seu jogo"),
  intro: L("Cinco perguntas rápidas e fica tudo pronto — grupo, primeiro jogo e convite.", "Five quick questions and everything's ready — group, first game and invite.", "Cinco perguntas rápidas e fica tudo pronto — grupo, primeiro jogo e convite."),
  useForm: L("Prefiro preencher o formulário", "I'd rather fill in the form", "Prefiro preencher o formulário"),
  back: L("Voltar", "Back", "Voltar"),
  send: L("Enviar", "Send", "Enviar"),
  next: L("Seguinte", "Next", "Próximo"),
  thinking: L("A perceber…", "Working it out…", "Entendendo…"),
  notUnderstood: L("Não apanhei bem — escolhe aqui em baixo.", "Didn't quite catch that — pick below.", "Não entendi direito — escolha aqui embaixo."),
  stepOf: L("{n} de {total}", "{n} of {total}", "{n} de {total}"),

  qVenue: L("Conta-me, onde jogam?", "Tell me, where do you play?", "Me conta, onde vocês jogam?"),
  phVenue: L("Ex.: Campo X — ou cola a frase toda: “às quintas às 21h no Campo X, 5 contra 5, 60 €”", "E.g. Campo X — or paste it all: “Thursdays 9pm at Campo X, 5-a-side, €60”", "Ex.: Arena X — ou cole a frase toda: “às quintas às 21h na Arena X, 5 contra 5, R$ 300”"),
  qWhen: L("Em que dia e a que horas?", "Which day and what time?", "Em que dia e que horas?"),
  phWhen: L("Ou escreve: “quintas às 21h”", "Or type: “Thursdays at 9pm”", "Ou escreva: “quintas às 21h”"),
  kickoff: L("Hora de início", "Kick-off", "Horário"),
  qFormat: L("Quantos jogam de cada lado?", "How many a side?", "Quantos jogam de cada lado?"),
  other: L("Outro", "Other", "Outro"),
  totalPlayers: L("Total de jogadores por jogo", "Total players per game", "Total de jogadores por jogo"),
  qPrice: L("Quanto custa o campo?", "How much is the pitch?", "Quanto custa o campo?"),
  phPrice: L("Total por jogo, ex.: 60", "Total per game, e.g. 60", "Total por jogo, ex.: 300"),
  free: L("Não pagamos", "We don't pay", "Não pagamos"),
  perPlayerLive: L("{price} por jogador ({spots} jogadores)", "{price} per player ({spots} players)", "{price} por pessoa ({spots} jogadores)"),
  qName: L("Como se chama o grupo?", "What's the group called?", "Qual é o nome do grupo?"),
  nameHint: L("Sugerimos este — muda à vontade.", "Here's a suggestion — change it if you like.", "Sugerimos este — mude à vontade."),

  // Confirmation card
  cardTitle: L("Está tudo certo?", "All good?", "Está tudo certo?"),
  cardSub: L("Toca em qualquer campo para mudar.", "Tap any field to change it.", "Toque em qualquer campo para mudar."),
  fName: L("Nome do grupo", "Group name", "Nome do grupo"),
  fVenue: L("Campo", "Pitch", "Campo"),
  fDay: L("Dia", "Day", "Dia"),
  fTime: L("Hora", "Time", "Horário"),
  fSpots: L("Jogadores por jogo", "Players per game", "Jogadores por jogo"),
  fCost: L("Custo do campo por jogo", "Pitch cost per game", "Custo do campo por jogo"),
  fPerPlayer: L("Por jogador", "Per player", "Por pessoa"),
  fRecurring: L("Todas as semanas", "Every week", "Toda semana"),
  fOpens: L("Confirmações abrem", "Confirmations open", "Confirmações abrem"),
  opensDays: L("{n} dias antes", "{n} days before", "{n} dias antes"),
  opensDay1: L("1 dia antes", "1 day before", "1 dia antes"),
  at: L("às", "at", "às"),
  firstGame: L("Primeiro jogo: {date} às {time}", "First game: {date} at {time}", "Primeiro jogo: {date} às {time}"),
  firstGameNone: L("Escolhe o dia e a hora para marcar o primeiro jogo.", "Pick a day and time to schedule the first game.", "Escolha o dia e o horário para marcar o primeiro jogo."),
  missingVenue: L("Falta o nome do campo.", "The pitch name is missing.", "Falta o nome do campo."),
  create: L("Está certo, criar", "Looks right, create", "Está certo, criar"),
  creating: L("A criar…", "Creating…", "Criando…"),
  createError: L("Não deu para criar o grupo. Tenta outra vez ou usa o formulário.", "Couldn't create the group. Try again or use the form.", "Não deu para criar o grupo. Tente de novo ou use o formulário."),

  // Invite step
  inviteTitle: L("Está criado! ⚽", "It's live! ⚽", "Está criado! ⚽"),
  inviteSub: L("O primeiro jogo já está marcado. Agora chama a malta.", "The first game is scheduled. Now bring the squad.", "O primeiro jogo já está marcado. Agora chama a galera."),
  inviteLink: L("Link de convite", "Invite link", "Link de convite"),
  copy: L("Copiar link", "Copy link", "Copiar link"),
  copied: L("Copiado ✓", "Copied ✓", "Copiado ✓"),
  shareWa: L("Partilhar no WhatsApp", "Share on WhatsApp", "Compartilhar no WhatsApp"),
  message: L("Mensagem pronta", "Ready-made message", "Mensagem pronta"),
  goToGame: L("Ir para o meu jogo", "Go to my game", "Ir para o meu jogo"),
};

export const MONTHS = {
  pt: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

registerStrings("en", EN);
registerStrings("pt-br", BR);
