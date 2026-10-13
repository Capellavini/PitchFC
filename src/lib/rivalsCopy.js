// All user-facing copy for PITCH Rivals, in one place. Same convention as
// pricingCopy.js: the PT-PT string IS the key (and the source language);
// L(pt, en, ptBr?) registers its EN and — when it differs — PT-BR
// translation with the shared i18n. Components render with t(RC.x) and
// fill `{placeholders}` with fmt(). PT-BR says "time" where PT-PT says
// "equipa"; EN says "team". "PITCH Rivals" is a product name: never
// translated (it's a plain constant, not an L() entry).

import { registerStrings, t } from "./i18n.js";

const EN = {};
const BR = {};
const L = (pt, en, ptBr) => {
  EN[pt] = en;
  if (ptBr !== undefined) BR[pt] = ptBr;
  return pt;
};

export const RIVALS_BRAND = "PITCH Rivals";

/** fmt("Olá {name}", { name: "Ana" }) — after t(). */
export const fmt = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
/** Translate + fill in one go. */
export const tf = (key, vars) => fmt(t(key), vars);

export const RC = {
  // ── Hub / segments ──
  tagline: L("A tua equipa. Os teus rivais. Cada jogo conta.", "Your team. Your rivals. Every game counts.", "Seu time. Seus rivais. Cada jogo conta."),
  segTeam: L("Equipa", "Team", "Time"),
  segDiscover: L("Descobrir", "Discover"),
  segChallenges: L("Desafios", "Challenges"),
  myTeam: L("A minha equipa", "My team", "Meu time"),
  switchTeam: L("Mudar de equipa", "Switch team", "Trocar de time"),
  newTeam: L("Nova equipa", "New team", "Novo time"),
  loading: L("A carregar equipas…", "Loading teams…", "Carregando times…"),

  // ── Empty state ──
  emptyTitle: L("Ainda não tens equipa", "You don't have a team yet", "Você ainda não tem time"),
  emptyBody: L(
    "Cria a tua equipa com nome, emblema e capitão. Convida o plantel por link e desafia outras equipas — o resultado conta para as duas.",
    "Create your team with a name, crest and captain. Invite your squad by link and challenge other teams — the result counts for both.",
    "Crie seu time com nome, escudo e capitão. Convide o elenco por link e desafie outros times — o resultado conta para os dois.",
  ),
  createTeam: L("Criar equipa", "Create team", "Criar time"),
  joinByInvite: L("Entrar por convite", "Join with an invite"),
  pasteInvite: L("Cola o link de convite da equipa", "Paste the team's invite link", "Cole o link de convite do time"),
  join: L("Entrar", "Join"),
  notAnInvite: L("Isto não parece um link de convite.", "That doesn't look like an invite link.", "Isso não parece um link de convite."),

  // ── Create / edit ──
  teamName: L("NOME DA EQUIPA", "TEAM NAME", "NOME DO TIME"),
  namePlaceholder: L("Ex.: Leões de Matosinhos", "e.g. Riverside Lions", "Ex.: Leões da Vila"),
  uploadBadge: L("Carregar emblema", "Upload crest", "Enviar escudo"),
  changeBadge: L("Trocar emblema", "Change crest", "Trocar escudo"),
  useInitials: L("Usar iniciais", "Use initials"),
  uploading: L("A carregar…", "Uploading…", "Enviando…"),
  badgeHint: L("Opcional — sem emblema usamos as iniciais nas cores da equipa.", "Optional — without a crest we use the initials in your team colours.", "Opcional — sem escudo usamos as iniciais nas cores do time."),
  badgeTooBig: L("Imagem demasiado grande (máx. 2 MB).", "Image too large (max 2 MB).", "Imagem grande demais (máx. 2 MB)."),
  badgeNotImage: L("O emblema tem de ser uma imagem.", "The crest must be an image.", "O escudo precisa ser uma imagem."),
  primaryColor: L("COR PRINCIPAL", "MAIN COLOUR"),
  secondaryColor: L("COR SECUNDÁRIA", "SECOND COLOUR"),
  colorN: L("Cor {n}", "Colour {n}"),
  country: L("PAÍS", "COUNTRY"),
  portugal: L("Portugal", "Portugal"),
  brazil: L("Brasil", "Brazil"),
  city: L("CIDADE", "CITY"),
  regionPT: L("DISTRITO", "DISTRICT"),
  regionBR: L("ESTADO", "STATE"),
  format: L("FORMATO", "FORMAT"),
  homeVenue: L("CAMPO DA CASA", "HOME PITCH", "CAMPO DE CASA"),
  homeVenueHint: L("Onde costumam jogar.", "Where you usually play.", "Onde vocês costumam jogar."),
  createHint: L(
    "Ficas como capitão. Depois convidas o plantel com um link — ninguém entra sem aceitar.",
    "You'll be captain. Then invite your squad with a link — nobody joins without accepting.",
    "Você fica como capitão. Depois convida o elenco com um link — ninguém entra sem aceitar.",
  ),
  creating: L("A criar…", "Creating…", "Criando…"),
  saving: L("A guardar…", "Saving…", "Salvando…"),
  save: L("Guardar", "Save", "Salvar"),
  editTeam: L("Editar equipa", "Edit team", "Editar time"),
  renameCaptainOnly: L("Só o capitão pode mudar o nome.", "Only the captain can rename the team.", "Só o capitão pode mudar o nome."),
  listedLabel: L("Aparecer no diretório de equipas", "Show in the team directory", "Aparecer no diretório de times"),
  listedHint: L("Outras equipas da tua zona encontram-vos para vos desafiar.", "Teams near you can find you and challenge you.", "Times da sua região encontram vocês para desafiar."),
  dangerZone: L("ZONA DE PERIGO", "DANGER ZONE"),
  archiveTeam: L("Arquivar equipa", "Archive team", "Arquivar time"),
  archiveConfirm: L(
    "Arquivar a equipa? O histórico fica guardado, mas deixa de aparecer e o link de convite deixa de funcionar.",
    "Archive the team? Its history is kept, but it disappears and the invite link stops working.",
    "Arquivar o time? O histórico fica guardado, mas ele some e o link de convite para de funcionar.",
  ),

  // ── Team page ──
  roleCaptain: L("Capitão", "Captain"),
  roleVice: L("Vice-capitão", "Vice-captain"),
  rolePlayer: L("Jogador", "Player"),
  captainShort: L("Capitão", "Captain"),
  viceShort: L("Vice", "Vice"),
  playersN: L("{n} jogadores", "{n} players"),
  playersOne: L("1 jogador", "1 player"),
  squad: L("PLANTEL", "SQUAD", "ELENCO"),
  record: L("REGISTO", "RECORD", "CAMPANHA"),
  noGamesYet: L("Ainda sem jogos", "No games yet"),
  noGamesBody: L(
    "Os desafios entre equipas chegam em breve. Vitórias, empates e derrotas aparecem aqui.",
    "Team challenges are coming soon. Wins, draws and losses will show up here.",
    "Os desafios entre times chegam em breve. Vitórias, empates e derrotas aparecem aqui.",
  ),
  played: L("Jogos", "Played"),
  wins: L("Vitórias", "Wins"),
  draws: L("Empates", "Draws"),
  losses: L("Derrotas", "Losses"),
  winShort: L("V", "W"),
  drawShort: L("E", "D"),
  lossShort: L("D", "L"),
  win: L("Vitória", "Win"),
  draw: L("Empate", "Draw"),
  loss: L("Derrota", "Loss"),
  invitePlayers: L("Convidar jogadores", "Invite players"),
  shareTeam: L("Partilhar equipa", "Share team", "Compartilhar time"),
  shareTeamMessage: L("⚽ Conhece a nossa equipa no PITCH Rivals: {url}", "⚽ Check out our team on PITCH Rivals: {url}", "⚽ Conheça nosso time no PITCH Rivals: {url}"),
  edit: L("Editar", "Edit"),
  leaveTeam: L("Sair da equipa", "Leave team", "Sair do time"),
  leaveConfirm: L("Sair de {team}?", "Leave {team}?"),
  leaveLastConfirm: L("És o último jogador: ao saíres, a equipa é arquivada. Sair na mesma?", "You're the last player: leaving archives the team. Leave anyway?", "Você é o último jogador: ao sair, o time é arquivado. Sair mesmo assim?"),
  challenge: L("Desafiar", "Challenge"),
  soon: L("em breve", "soon"),
  since: L("desde {date}", "since {date}"),
  yourRole: L("O teu papel", "Your role", "Seu papel"),
  you: L("(tu)", "(you)", "(você)"),

  scoreLess: L("Menos um golo · {team}", "One goal less · {team}", "Menos um gol · {team}"),
  scoreMore: L("Mais um golo · {team}", "One goal more · {team}", "Mais um gol · {team}"),

  // ── Roster actions ──
  memberActions: L("Ações · {nick}", "Actions · {nick}"),
  makeVice: L("Tornar vice-capitão", "Make vice-captain"),
  removeVice: L("Tirar de vice-capitão", "Remove as vice-captain"),
  transferCaptaincy: L("Passar a braçadeira", "Hand over the armband"),
  transferConfirm: L(
    "Passar a braçadeira a {nick}? Ficas como vice-capitão (ou jogador, se já houver vice).",
    "Hand the armband to {nick}? You'll become vice-captain (or player, if there's already a vice).",
    "Passar a braçadeira para {nick}? Você fica como vice-capitão (ou jogador, se já houver vice).",
  ),
  removeMember: L("Remover da equipa", "Remove from team", "Remover do time"),
  removeConfirm: L("Remover {nick} da equipa? Só volta com um link de convite novo.", "Remove {nick} from the team? They can only come back with a new invite link.", "Remover {nick} do time? Só volta com um link de convite novo."),
  confirm: L("Confirmar", "Confirm"),
  cancel: L("Cancelar", "Cancel"),
  close: L("Fechar", "Close"),

  // ── Invite sheet ──
  inviteTitle: L("Convidar para a equipa", "Invite to the team", "Convidar para o time"),
  inviteBody: L(
    "Quem abrir o link entra como jogador. Só tu e o vice gerem o plantel.",
    "Whoever opens the link joins as a player. Only you and the vice manage the squad.",
    "Quem abrir o link entra como jogador. Só você e o vice gerenciam o elenco.",
  ),
  copyLink: L("Copiar link", "Copy link"),
  copied: L("Copiado!", "Copied!"),
  sendWhatsApp: L("Enviar no WhatsApp", "Send on WhatsApp"),
  expiresIn: L("Expira em {n} dias", "Expires in {n} days"),
  expiresTomorrow: L("Expira amanhã", "Expires tomorrow"),
  usesLine: L("{n} entraram por este link", "{n} joined with this link"),
  newLink: L("Gerar link novo", "New link"),
  newLinkHint: L("O link antigo deixa de funcionar.", "The old link stops working.", "O link antigo para de funcionar."),
  revokeLink: L("Desativar link", "Disable link"),
  linkRevoked: L("Link desativado. Gera um novo quando quiseres.", "Link disabled. Create a new one whenever you want.", "Link desativado. Gere um novo quando quiser."),
  loadingLink: L("A gerar link…", "Creating link…", "Gerando link…"),
  inviteMessage: L("⚽ Junta-te à equipa {team} no PITCH Rivals! Entra no plantel aqui: {url}", "⚽ Join {team} on PITCH Rivals! Join the squad here: {url}", "⚽ Entre no time {team} no PITCH Rivals! Entre no elenco aqui: {url}"),
  shareGroupHint: L("Dica: partilha o link no grupo de WhatsApp da malta.", "Tip: share the link in your football WhatsApp group.", "Dica: compartilhe o link no grupo de WhatsApp da galera."),

  // ── Public team page ──
  openMyTeam: L("Abrir a minha equipa", "Open my team", "Abrir meu time"),
  enterPitch: L("Entrar no PITCH", "Join PITCH"),
  teamNotFound: L("Equipa não encontrada", "Team not found", "Time não encontrado"),
  teamNotFoundBody: L("O link pode estar errado ou a equipa foi arquivada.", "The link may be wrong or the team was archived.", "O link pode estar errado ou o time foi arquivado."),
  archivedTeam: L("Esta equipa foi arquivada.", "This team was archived.", "Este time foi arquivado."),
  createYourTeam: L("Cria a tua equipa", "Create your team", "Crie seu time"),
  seeTeam: L("Ver equipa", "See team", "Ver time"),

  // ── Directory ──
  discoverTitle: L("Equipas perto de ti", "Teams near you", "Times perto de você"),
  discoverSub: L("Encontra rivais à tua medida.", "Find rivals your size.", "Encontre rivais do seu nível."),
  searchPlaceholder: L("Procurar equipa ou cidade", "Search team or city", "Buscar time ou cidade"),
  cityPlaceholder: L("Cidade", "City"),
  allFormats: L("Todos", "All"),
  onlyNear: L("Só a minha zona", "Only my area", "Só a minha região"),
  emptyDirectoryCity: L("És a primeira equipa em {city} — convida rivais.", "You're the first team in {city} — invite rivals.", "Você é o primeiro time em {city} — convide rivais."),
  emptyDirectory: L("Ainda não há equipas aqui — convida rivais.", "No teams here yet — invite rivals.", "Ainda não há times aqui — convide rivais."),
  inviteRivals: L("Convidar rivais", "Invite rivals"),
  inviteRivalsMessage: L("⚽ Criámos a nossa equipa no PITCH Rivals. Criem a vossa e desafiem-nos: {url}", "⚽ We created our team on PITCH Rivals. Create yours and challenge us: {url}", "⚽ Criamos nosso time no PITCH Rivals. Criem o de vocês e desafiem a gente: {url}"),
  loadMore: L("Ver mais", "Load more"),
  yourTeamBadge: L("A tua equipa", "Your team", "Seu time"),
  inYourCity: L("Na tua cidade", "In your city", "Na sua cidade"),

  // ── Invite landing (?tjoin) ──
  invitedBy: L("{inviter} convidou-te para a equipa", "{inviter} invited you to the team", "{inviter} convidou você para o time"),
  invitedGeneric: L("Convite para a equipa", "Team invite", "Convite para o time"),
  joinTeam: L("Entrar na equipa", "Join the team", "Entrar no time"),
  joining: L("A entrar…", "Joining…", "Entrando…"),
  signupToJoin: L("Criar conta e entrar", "Sign up and join"),
  haveAccount: L("Já tenho conta", "I already have an account", "Já tenho conta"),
  alreadyMember: L("Já fazes parte desta equipa.", "You're already in this team.", "Você já faz parte deste time."),
  openTeam: L("Abrir equipa", "Open team", "Abrir time"),
  inviteRoleNote: L("Entras como jogador. O capitão gere o plantel.", "You join as a player. The captain manages the squad.", "Você entra como jogador. O capitão gerencia o elenco."),
  inviteExpiredTitle: L("Convite expirado", "Invite expired"),
  inviteRevokedTitle: L("Convite desativado", "Invite disabled"),
  inviteUsedTitle: L("Convite já usado", "Invite already used"),
  inviteNotFoundTitle: L("Convite inválido", "Invalid invite"),
  inviteArchivedTitle: L("Equipa arquivada", "Team archived", "Time arquivado"),
  askCaptain: L("Pede um link novo ao capitão da equipa.", "Ask the team captain for a new link.", "Peça um link novo ao capitão do time."),
  notNow: L("Agora não", "Not now"),
  checkingInvite: L("A verificar o convite…", "Checking the invite…", "Verificando o convite…"),
  joinedToast: L("Bem-vindo à equipa {team}!", "Welcome to {team}!", "Bem-vindo ao time {team}!"),

  // ── Home / Jogar / Perfil ──
  teamGamesInCompetir: L("Os jogos da tua equipa estão em Competir", "Your team's games are in Compete", "Os jogos do seu time estão em Competir"),
  homeTeamInviteTitle: L("Completa o plantel: {team}", "Fill your squad: {team}", "Complete o elenco: {team}"),
  homeTeamInviteSub: L("{n} no plantel · convida por link", "{n} in the squad · invite by link", "{n} no elenco · convide por link"),
  homeTeamJoined: L("Entraste na equipa {team}", "You joined {team}", "Você entrou no time {team}"),
  homeTeamCreated: L("Criaste a equipa {team}", "You created {team}", "Você criou o time {team}"),
  homeTeamSub: L("Os desafios entre equipas chegam em breve.", "Team challenges are coming soon.", "Os desafios entre times chegam em breve."),
  noTeamGameTitle: L("Sem jogos de equipa marcados", "No team games scheduled", "Sem jogos de time marcados"),
  noTeamGameSub: L("Quando a tua equipa tiver jogo, aparece aqui.", "When your team has a game, it shows up here.", "Quando seu time tiver jogo, aparece aqui."),
  openRivals: L("Abrir equipa", "Open team", "Abrir time"),
  teamsLabel: L("EQUIPAS", "TEAMS", "TIMES"),
  teamChip: L("Equipa", "Team", "Time"),

  // ── /rivals signup → account + team (decision 2026-10-13 a) ──
  suYourName: L("O teu nome *", "Your name *", "Seu nome *"),
  suWhatsApp: L("WhatsApp *", "WhatsApp *"),
  suCity: L("Cidade *", "City *"),
  suCityPh: L("Porto, Matosinhos…", "Porto, Lisbon…", "São Paulo, Campinas…"),
  suTeamName: L("Nome da equipa *", "Team name *", "Nome do time *"),
  suPlayers: L("Nº de jogadores no plantel", "Players in the squad", "Nº de jogadores no elenco"),
  suEmail: L("Email *", "Email *"),
  suPassword: L("Palavra-passe *", "Password *", "Senha *"),
  suPasswordHint: L("Mínimo 6 caracteres. É a tua conta PITCH.", "At least 6 characters. It's your PITCH account.", "Mínimo 6 caracteres. É a sua conta PITCH."),
  suFormat: L("Formato", "Format"),
  suPlays: L("Já jogam contra outras equipas?", "Do you already play other teams?", "Vocês já jogam contra outros times?"),
  suPlaysOften: L("Sim, com frequência", "Yes, often"),
  suPlaysSometimes: L("De vez em quando", "Now and then"),
  suPlaysNotYet: L("Ainda não — queremos começar", "Not yet — we want to start"),
  suSubmit: L("Criar conta e equipa", "Create account and team", "Criar conta e time"),
  suSubmitLogged: L("Criar a minha equipa", "Create my team", "Criar meu time"),
  suBusy: L("A criar…", "Creating…", "Criando…"),
  suFine: L("Grátis · ficas como capitão · só te contactamos sobre o PITCH Rivals.", "Free · you'll be captain · we only contact you about PITCH Rivals.", "Grátis · você fica como capitão · só falamos com você sobre o PITCH Rivals."),
  suTerms: L("Ao criar conta, aceitas os Termos de Uso e a Política de Privacidade.", "By creating an account you accept the Terms of Use and the Privacy Policy.", "Ao criar conta, você aceita os Termos de Uso e a Política de Privacidade."),
  suLoggedAs: L("Tens sessão iniciada como {who}. A equipa fica na tua conta, contigo como capitão.", "You're signed in as {who}. The team goes on your account, with you as captain.", "Você está conectado como {who}. O time fica na sua conta, com você como capitão."),
  errName: L("Diz-nos o teu nome.", "Tell us your name.", "Diga seu nome."),
  errWhatsApp: L("Precisamos de um número de WhatsApp válido.", "We need a valid WhatsApp number.", "Precisamos de um número de WhatsApp válido."),
  errCity: L("Em que cidade jogam?", "Which city do you play in?", "Em que cidade vocês jogam?"),
  errTeamName: L("O nome da equipa tem de ter entre 2 e 40 caracteres.", "The team name must be 2 to 40 characters.", "O nome do time precisa ter entre 2 e 40 caracteres."),
  errEmail: L("Precisamos do teu email.", "We need your email.", "Precisamos do seu email."),
  errEmailBad: L("Este email não parece válido.", "This email doesn't look valid.", "Este email não parece válido."),
  errPassword: L("A palavra-passe precisa de pelo menos 6 caracteres.", "The password needs at least 6 characters.", "A senha precisa de pelo menos 6 caracteres."),
  errWeakPassword: L("Palavra-passe demasiado fraca. Usa pelo menos 6 caracteres, com letras e números.", "Password too weak. Use at least 6 characters, with letters and numbers.", "Senha fraca demais. Use pelo menos 6 caracteres, com letras e números."),
  errNetwork: L("Sem ligação. Verifica a internet e tenta outra vez.", "No connection. Check your internet and try again.", "Sem conexão. Verifique a internet e tente de novo."),
  errRateLimit: L("Demasiadas tentativas. Espera um minuto e tenta outra vez.", "Too many attempts. Wait a minute and try again.", "Muitas tentativas. Espere um minuto e tente de novo."),
  errGeneric: L("Não conseguimos criar a conta agora. Tenta outra vez.", "We couldn't create the account right now. Try again.", "Não conseguimos criar a conta agora. Tente de novo."),
  errBadLogin: L("Email ou palavra-passe errados.", "Wrong email or password.", "Email ou senha incorretos."),
  errNotConfirmed: L("Ainda não confirmaste o email — abre o link que te enviámos.", "You haven't confirmed your email yet — open the link we sent you.", "Você ainda não confirmou o email — abra o link que enviamos."),
  existsTitle: L("Este email já tem conta", "This email already has an account", "Este email já tem conta"),
  existsBody: L("Entra com a tua palavra-passe e criamos a {team} logo a seguir.", "Log in with your password and we'll create {team} right after.", "Entre com sua senha e criamos o {team} logo em seguida."),
  existsLogin: L("Entrar e criar a equipa", "Log in and create the team", "Entrar e criar o time"),
  forgotPassword: L("Esqueci-me da palavra-passe", "I forgot my password", "Esqueci minha senha"),
  useOtherEmail: L("Usar outro email", "Use another email", "Usar outro email"),
  confirmTitle: L("Confirma o teu email", "Confirm your email", "Confirme seu email"),
  confirmBody: L("Enviámos um link para {email}. Abre-o (de preferência neste telemóvel) e voltas logo à app para criar a {team}.", "We sent a link to {email}. Open it (ideally on this phone) and you'll land back in the app to create {team}.", "Enviamos um link para {email}. Abra-o (de preferência neste celular) e você volta direto ao app para criar o {team}."),
  confirmSpam: L("Não chegou? Vê o spam ou reenvia.", "Not there? Check spam or resend.", "Não chegou? Veja o spam ou reenvie."),
  resend: L("Reenviar email", "Resend email", "Reenviar email"),
  resent: L("Enviado de novo ✓", "Sent again ✓", "Enviado de novo ✓"),
  demoTitle: L("Modo demo", "Demo mode"),
  demoBody: L("Esta versão corre sem servidor: não há email nem conta real. Simula a confirmação para veres o resto do fluxo.", "This version runs without a server: no email or real account. Simulate the confirmation to see the rest of the flow.", "Esta versão roda sem servidor: não há email nem conta real. Simule a confirmação para ver o resto do fluxo."),
  demoConfirm: L("Simular confirmação do email", "Simulate email confirmation", "Simular confirmação do email"),
  creatingTeamNow: L("A criar a tua equipa…", "Creating your team…", "Criando seu time…"),

  // ── Pitch AI CTA (decision 2026-10-13 b) ──
  pitchAiCta: L("🤖 O Pitch AI ajuda-te a montar a equipa", "🤖 Pitch AI helps you build the team", "🤖 O Pitch AI ajuda você a montar o time"),
  pitchAiBody: L("Fala com o Pitch AI no WhatsApp: recebes o link de convite e um guia rápido para juntar o plantel.", "Chat with Pitch AI on WhatsApp: get your invite link and a quick guide to gather the squad.", "Fale com o Pitch AI no WhatsApp: receba o link de convite e um guia rápido para juntar o elenco."),
  pitchAiOpen: L("Abrir no WhatsApp", "Open in WhatsApp", "Abrir no WhatsApp"),

  // ── Team-mode navigation (decision 2026-10-13 c) ──
  playTitle: L("Jogar", "Play"),
  nextTeamMatch: L("PRÓXIMO JOGO DA EQUIPA", "TEAM'S NEXT MATCH", "PRÓXIMO JOGO DO TIME"),
  vsOpponent: L("vs {team}", "vs {team}"),
  opponentTbd: L("Adversário por confirmar", "Opponent to be confirmed", "Adversário a confirmar"),
  today: L("Hoje", "Today"),
  inDays: L("Faltam {n} dias", "{n} days to go", "Faltam {n} dias"),
  tomorrow: L("Amanhã", "Tomorrow"),
  callUp: L("CONVOCATÓRIA", "CALL-UP", "CONVOCAÇÃO"),
  callUpQ: L("Vais a jogo?", "Are you playing?", "Você vai jogar?"),
  rsvpYes: L("Vou", "I'm in", "Vou"),
  rsvpNo: L("Não vou", "Can't make it", "Não vou"),
  rsvpMaybe: L("Talvez", "Maybe"),
  rsvpSoon: L("A convocatória da equipa chega em breve — por agora a resposta não fica guardada.", "Team call-ups are coming soon — for now your answer isn't saved.", "A convocação do time chega em breve — por enquanto a resposta não fica salva."),
  rsvpSaved: L("Resposta guardada.", "Answer saved.", "Resposta salva."),
  findRivals: L("Encontrar rivais", "Find rivals"),
  noTeamGameBody: L("Quando a equipa tiver um jogo combinado, aparece aqui com a convocatória.", "When your team has a match agreed, it shows up here with the call-up.", "Quando o time tiver um jogo combinado, ele aparece aqui com a convocação."),
  alsoGroups: L("Também jogas uma pelada semanal? Entra no grupo", "Also play a weekly game? Join the group", "Também joga uma pelada semanal? Entre no grupo"),
  matchdayToday: L("HOJE HÁ JOGO", "MATCH DAY", "HOJE TEM JOGO"),
  scoreSoon: L("Marcar golos (em breve)", "Log goals (soon)", "Marcar gols (em breve)"),
  scoreSoonHint: L("Golos e assistências por jogador nos jogos de equipa chegam na próxima versão.", "Per-player goals and assists for team matches arrive in the next version.", "Gols e assistências por jogador nos jogos de time chegam na próxima versão."),
  tactics: L("Tática — {team}", "Tactics — {team}", "Tática — {team}"),
  tacticsNeedPlayers: L("O quadro tático abre com 7 ou mais jogadores no plantel.", "The tactics board opens with 7 or more players in the squad.", "O quadro tático abre com 7 ou mais jogadores no elenco."),
  matchdayCountdownBody: L("No dia do jogo, o Matchday da equipa abre aqui: quadro tático e marcador.", "On match day, the team's Matchday opens here: tactics board and scoring.", "No dia do jogo, o Matchday do time abre aqui: quadro tático e placar."),
  matchdayEmptyTitle: L("Sem jogo da equipa hoje", "No team match today", "Sem jogo do time hoje"),
};

const ERRORS = {
  not_authenticated: L("Inicia sessão para continuar.", "Sign in to continue.", "Entre para continuar."),
  no_profile: L("Cria primeiro o teu cartão de jogador.", "Create your player card first.", "Crie primeiro seu cartão de jogador."),
  team_not_found: L("Equipa não encontrada.", "Team not found.", "Time não encontrado."),
  team_archived: RC.archivedTeam,
  not_team_leader: L("Só o capitão ou o vice podem fazer isto.", "Only the captain or vice can do this.", "Só o capitão ou o vice podem fazer isso."),
  captain_only: L("Só o capitão pode fazer isto.", "Only the captain can do this.", "Só o capitão pode fazer isso."),
  invalid_name: L("O nome da equipa tem de ter entre 2 e 40 caracteres.", "The team name must be 2 to 40 characters.", "O nome do time precisa ter entre 2 e 40 caracteres."),
  invalid_field: L("Há um campo inválido. Revê o formulário.", "A field is invalid. Check the form.", "Há um campo inválido. Revise o formulário."),
  duplicate_name: L("Já tens uma equipa com esse nome.", "You already have a team with that name.", "Você já tem um time com esse nome."),
  too_many_teams: L("Já és capitão de 5 equipas — é o máximo.", "You already captain 5 teams — that's the limit.", "Você já é capitão de 5 times — é o máximo."),
  network: L("Sem ligação. Tenta outra vez.", "No connection. Try again.", "Sem conexão. Tente de novo."),
  unknown: L("Algo correu mal. Tenta outra vez.", "Something went wrong. Try again.", "Algo deu errado. Tente de novo."),
  invite_not_found: L("Convite inválido. Pede um link novo ao capitão.", "Invalid invite. Ask the captain for a new link.", "Convite inválido. Peça um link novo ao capitão."),
  invite_expired: L("Este convite expirou. Pede um link novo ao capitão.", "This invite has expired. Ask the captain for a new link.", "Este convite expirou. Peça um link novo ao capitão."),
  invite_revoked: L("Este convite foi desativado. Pede um link novo ao capitão.", "This invite was disabled. Ask the captain for a new link.", "Este convite foi desativado. Peça um link novo ao capitão."),
  invite_used_up: L("Este convite já foi usado. Pede um link novo ao capitão.", "This invite was already used. Ask the captain for a new link.", "Este convite já foi usado. Peça um link novo ao capitão."),
  removed_from_team: L("Foste removido desta equipa. Só voltas com um convite novo.", "You were removed from this team. You need a new invite to come back.", "Você foi removido deste time. Só volta com um convite novo."),
  team_full: L("A equipa está cheia (40 jogadores).", "The team is full (40 players).", "O time está cheio (40 jogadores)."),
  not_a_member: L("Este jogador já não está na equipa.", "This player is no longer in the team.", "Este jogador não está mais no time."),
  use_transfer: L("Para mudar o capitão, usa “Passar a braçadeira”.", "To change captain, use “Hand over the armband”.", "Para mudar o capitão, use “Passar a braçadeira”."),
  invalid_target: L("Escolhe um jogador da equipa.", "Pick a player from the team.", "Escolha um jogador do time."),
  cannot_remove_captain: L("O capitão não pode ser removido.", "The captain can't be removed."),
  use_leave: L("Para saíres, usa “Sair da equipa”.", "To leave, use “Leave team”.", "Para sair, use “Sair do time”."),
  captain_must_transfer: L("Passa a braçadeira a outro jogador antes de saíres.", "Hand the armband to another player before you leave.", "Passe a braçadeira para outro jogador antes de sair."),
};
const FIELD_CODES = ["invalid_color", "invalid_format", "invalid_country", "invalid_timezone", "invalid_currency", "field_too_long", "invalid_logo", "invalid_expiry", "invalid_max_uses", "invalid_role"];

/** Error code (see rivals.js rivalsErrorCode) → translated message. */
export function rivalsError(code) {
  if (FIELD_CODES.includes(code)) return t(ERRORS.invalid_field);
  if (code === "try_again") return t(ERRORS.network);
  if (code === "badge_not_image") return t(RC.badgeNotImage);
  if (code === "badge_too_big") return t(RC.badgeTooBig);
  return t(ERRORS[code] || ERRORS.unknown);
}

registerStrings("en", EN);
registerStrings("pt-br", BR);
