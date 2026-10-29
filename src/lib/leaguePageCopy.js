// /league — "PITCH para Ligas": the page for organizers of EXISTING
// amateur leagues (PITCH does not run a league). Same convention as
// pricingCopy / rivalsCopy: the PT-PT string is the key; L(pt, en, ptBr)
// registers EN and native PT-BR ("time", "torcida", "campeonato", "rodada").
import { registerStrings } from "./i18n.js";

const EN = {};
const BR = {};
const L = (pt, en, ptBr) => {
  EN[pt] = en;
  if (ptBr !== undefined) BR[pt] = ptBr;
  return pt;
};

export const LP = {
  navHow: L("Como funciona", "How it works", "Como funciona"),
  navBenefits: L("O que ganhas", "What you get", "O que você ganha"),
  navFaq: L("Perguntas", "FAQ", "Perguntas"),
  navPilot: L("Pedir piloto", "Request pilot", "Pedir piloto"),
  badge: L("Piloto", "Pilot", "Piloto"),
  eyebrow: L("PITCH PARA LIGAS", "PITCH FOR LEAGUES", "PITCH PARA LIGAS"),
  h1: L("A tua liga, organizada", "Your league, organised", "Seu campeonato, organizado"),
  h1Accent: L("jornada a jornada.", "matchday by matchday.", "rodada a rodada."),
  sub: L(
    "Inscrições, calendário, súmulas validadas e classificação automática. E os adeptos a acompanhar tudo no telemóvel.",
    "Registrations, fixtures, validated match reports and automatic standings. And the fans following everything on their phones.",
    "Inscrições, tabela de jogos, súmulas validadas e classificação automática. E a torcida acompanhando tudo pelo celular.",
  ),
  ctaPilot: L("Quero a minha liga no piloto", "I want my league in the pilot", "Quero meu campeonato no piloto"),
  ctaDemo: L("Ver demonstração", "See the demo", "Ver demonstração"),
  demoNote: L("Demonstração com uma liga fictícia — dados só no teu navegador.", "Demo with a fictional league — data stays in your browser.", "Demonstração com um campeonato fictício — dados só no seu navegador."),

  painTitle: L("Chega de Excel, grupos de WhatsApp e resultados contestados.", "No more spreadsheets, WhatsApp groups and disputed results.", "Chega de planilha, grupo de WhatsApp e resultado contestado."),
  pain1: L("Classificação feita à mão, sempre desatualizada", "Standings done by hand, always out of date", "Classificação feita na mão, sempre desatualizada"),
  pain2: L("Súmulas em papel e golos esquecidos", "Paper match reports and forgotten goals", "Súmula no papel e gol esquecido"),
  pain3: L("Adeptos sem saber quando e onde joga a equipa", "Fans who don't know when and where their team plays", "Torcida sem saber quando e onde o time joga"),

  benefitsTitle: L("O que a tua liga ganha", "What your league gets", "O que o seu campeonato ganha"),
  b1t: L("Gestão num só sítio", "Management in one place", "Gestão num só lugar"),
  b1: L("Inscrições, plantéis, calendário e pendências.", "Registrations, squads, fixtures and to-dos.", "Inscrições, elencos, tabela de jogos e pendências."),
  b2t: L("Súmula digital", "Digital match report", "Súmula digital"),
  b2: L("Golos, assistências e cartões ao vivo; o resultado só conta depois de homologado.", "Goals, assists and cards live; the result only counts once it's confirmed.", "Gols, assistências e cartões ao vivo; o resultado só vale depois de homologado."),
  b3t: L("Classificação e estatísticas automáticas", "Automatic standings and stats", "Classificação e estatísticas automáticas"),
  b3: L("Calculadas a partir dos jogos, nunca editadas à mão.", "Calculated from the matches, never edited by hand.", "Calculadas a partir dos jogos, nunca editadas na mão."),
  b4t: L("Jogadores com PITCH ID", "Players with a PITCH ID", "Jogadores com PITCH ID"),
  b4: L("Cartão, OVR e estatísticas de cada competição.", "Card, OVR and stats for each competition.", "Card, OVR e estatísticas de cada competição."),
  b5t: L("Adeptos e Pitch Manager", "Fans and Pitch Manager", "Torcida e Pitch Manager"),
  b5: L("Seguem a equipa, votam no craque da torcida e jogam o Pitch Manager da liga.", "They follow their team, vote for the fans' player of the match and play the league's Pitch Manager.", "Seguem o time, votam no craque da torcida e jogam o Pitch Manager do campeonato."),

  howTitle: L("Como funciona o piloto", "How the pilot works", "Como funciona o piloto"),
  how1: L("Falamos contigo e configuramos a competição.", "We talk to you and set up the competition.", "A gente conversa com você e configura a competição."),
  how2: L("As equipas inscrevem-se pelo link.", "Teams sign up through a link.", "Os times se inscrevem pelo link."),
  how3: L("Jogo a jogo, a súmula alimenta tudo.", "Match by match, the report feeds everything.", "Jogo a jogo, a súmula alimenta tudo."),
  howNote: L("Piloto gratuito para as primeiras ligas, em troca do vosso feedback.", "Free pilot for the first leagues, in exchange for your feedback.", "Piloto gratuito para os primeiros campeonatos, em troca do feedback de vocês."),

  fanTitle: L("És adepto? Escolhe a tua equipa e acompanha a liga.", "Are you a fan? Pick your team and follow the league.", "É torcedor? Escolha seu time e acompanhe o campeonato."),
  fanCta: L("Sou adepto", "I'm a fan", "Sou torcedor"),

  faqTitle: L("Perguntas frequentes", "Frequently asked questions", "Perguntas frequentes"),
  q1: L("Quanto custa?", "How much does it cost?", "Quanto custa?"),
  a1: L("O piloto é gratuito. Depois, o preço é por equipa inscrita por época — os jogadores e os adeptos não pagam.", "The pilot is free. After that, pricing is per registered team per season — players and fans don't pay.", "O piloto é gratuito. Depois, o preço é por time inscrito por temporada — jogadores e torcedores não pagam."),
  q2: L("Precisamos de mudar o nosso regulamento?", "Do we need to change our rules?", "Precisamos mudar nosso regulamento?"),
  a2: L("Não. Configuras pontos, desempates e disciplina conforme o vosso regulamento.", "No. You set points, tiebreakers and discipline to match your rules.", "Não. Você configura pontos, critérios de desempate e disciplina conforme o regulamento de vocês."),
  q3: L("Os jogadores precisam de instalar alguma coisa?", "Do players need to install anything?", "Os jogadores precisam instalar alguma coisa?"),
  a3: L("Não. Entram pelo link, no telemóvel.", "No. They join through a link, on their phones.", "Não. Entram pelo link, no celular."),
  q4: L("Quem valida os resultados?", "Who validates the results?", "Quem valida os resultados?"),
  a4: L("A organização da liga. O resultado fica provisório até ser homologado.", "The league's organisers. A result stays provisional until it's confirmed.", "A organização do campeonato. O resultado fica provisório até ser homologado."),

  // form
  formTitle: L("Pede o piloto para a tua liga", "Request the pilot for your league", "Peça o piloto para o seu campeonato"),
  formSub: L("Respondemos em poucos dias. Sem compromisso.", "We reply within a few days. No commitment.", "Respondemos em poucos dias. Sem compromisso."),
  fName: L("O teu nome", "Your name", "Seu nome"),
  fEmail: L("Email", "Email", "E-mail"),
  fWhatsapp: L("WhatsApp", "WhatsApp", "WhatsApp"),
  fLeague: L("Nome da liga", "League name", "Nome do campeonato"),
  fCity: L("Cidade", "City", "Cidade"),
  fTeams: L("Número de equipas", "Number of teams", "Número de times"),
  fModality: L("Modalidade", "Format", "Modalidade"),
  fMessage: L("Mensagem (opcional)", "Message (optional)", "Mensagem (opcional)"),
  fMessagePh: L("Ex.: época de setembro a junho, jogos ao sábado, 2 campos…", "E.g. season September to June, Saturday games, 2 pitches…", "Ex.: temporada de setembro a junho, jogos aos sábados, 2 campos…"),
  required: L("obrigatório", "required", "obrigatório"),
  errRequired: L("Preenche o teu nome, o nome da liga e pelo menos o email ou o WhatsApp.", "Fill in your name, the league name and at least your email or WhatsApp.", "Preencha seu nome, o nome do campeonato e pelo menos o e-mail ou o WhatsApp."),
  errSend: L("Não foi possível enviar. Tenta outra vez.", "Couldn't send. Please try again.", "Não foi possível enviar. Tente novamente."),
  send: L("Pedir piloto", "Request the pilot", "Pedir piloto"),
  sending: L("A enviar…", "Sending…", "Enviando…"),
  privacy: L("Usamos os teus dados só para falar contigo sobre o piloto.", "We only use your details to talk to you about the pilot.", "Usamos seus dados só para falar com você sobre o piloto."),
  okTitle: L("Pedido recebido! ⚽", "Request received! ⚽", "Pedido recebido! ⚽"),
  okBody: L("Vamos falar contigo em breve para configurar a tua liga.", "We'll be in touch soon to set up your league.", "Vamos falar com você em breve para configurar o seu campeonato."),
  enterApp: L("Entrar no app", "Open the app", "Entrar no app"),
  tableLabel: L("Classificação da liga", "League standings", "Classificação do campeonato"),
  played: L("J", "GP", "J"),
  fictional: L("liga fictícia (demonstração)", "fictional league (demo)", "campeonato fictício (demonstração)"),
  modalityF5: L("Futebol 5", "5-a-side", "Futebol 5 (society)"),
  modalityF7: L("Futebol 7", "7-a-side", "Futebol 7 (society)"),
  modalityF11: L("Futebol 11", "11-a-side", "Futebol de campo (11)"),
  modalityFutsal: L("Futsal", "Futsal", "Futsal"),
  modalityOther: L("Outra", "Other", "Outra"),
  footerLine: L("PITCH para Ligas · serviço digital para ligas de futebol amador que já existem.", "PITCH for Leagues · a digital service for amateur football leagues that already exist.", "PITCH para Ligas · serviço digital para campeonatos de futebol amador que já existem."),
};

registerStrings("en", EN);
registerStrings("pt-br", BR);
