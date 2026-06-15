// ─────────────────────────────────────────────────────────
// MOCK DATA (mirrors the Supabase schema in CLAUDE.md).
// This becomes the seed data when the backend lands.
// ─────────────────────────────────────────────────────────
import { isoDay } from "./lib/helpers";
export const INITIAL_GROUP = [
  { id: 1,  name: "Carlos Silva",     nick: "Carlão",     status: "confirmed", paid: true,  isMe: true,
    email: "carlos@email.com", phone: "+351 912 345 678", position: "Médio",    foot: "Direito",
    age: 29, nationality: "🇵🇹 Portugal", club: "FC Porto",
    attrs: { rit: 78, rem: 74, pas: 84, dri: 79, def: 66, fis: 75 },
    goals: 12, assists: 8,  mvps: 3, gamesPlayed: 13 },
  { id: 2,  name: "João Ferreira",    nick: "Joãozão",    status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 001", position: "Avançado", foot: "Direito",
    age: 31, nationality: "🇵🇹 Portugal", club: "SL Benfica",
    attrs: { rit: 84, rem: 88, pas: 70, dri: 81, def: 42, fis: 79 },
    goals: 21, assists: 5,  mvps: 5, gamesPlayed: 15 },
  { id: 3,  name: "Miguel Santos",    nick: "Miguelinho", status: "confirmed", paid: false,
    email: "", phone: "+351 913 000 002", position: "Defesa",   foot: "Esquerdo",
    age: 27, nationality: "🇵🇹 Portugal", club: "Sporting CP",
    attrs: { rit: 72, rem: 55, pas: 74, dri: 64, def: 84, fis: 82 },
    goals: 3,  assists: 11, mvps: 2, gamesPlayed: 11 },
  { id: 4,  name: "Rui Oliveira",     nick: "Ruizão",     status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 003", position: "Guarda-redes", foot: "Direito",
    age: 33, nationality: "🇵🇹 Portugal", club: "FC Porto",
    attrs: { rit: 58, rem: 40, pas: 66, dri: 50, def: 88, fis: 80 },
    goals: 0,  assists: 2,  mvps: 4, gamesPlayed: 14 },
  { id: 5,  name: "Diogo Costa",      nick: "Diogo",      status: "confirmed", paid: false,
    email: "", phone: "+351 913 000 004", position: "Médio",    foot: "Direito",
    age: 25, nationality: "🇵🇹 Portugal", club: "SC Braga",
    attrs: { rit: 80, rem: 70, pas: 86, dri: 82, def: 60, fis: 70 },
    goals: 9,  assists: 13, mvps: 1, gamesPlayed: 9 },
  { id: 6,  name: "André Lima",       nick: "Liminha",    status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 005", position: "Avançado", foot: "Esquerdo",
    age: 28, nationality: "🇧🇷 Brasil", club: "Flamengo",
    attrs: { rit: 87, rem: 84, pas: 72, dri: 86, def: 38, fis: 68 },
    goals: 17, assists: 4,  mvps: 2, gamesPlayed: 12 },
  { id: 7,  name: "Pedro Neves",      nick: "Pedão",      status: "confirmed", paid: false,
    email: "", phone: "+351 913 000 006", position: "Defesa",   foot: "Direito",
    age: 30, nationality: "🇵🇹 Portugal", club: "Vitória SC",
    attrs: { rit: 68, rem: 52, pas: 70, dri: 60, def: 80, fis: 85 },
    goals: 2,  assists: 6,  mvps: 0, gamesPlayed: 10 },
  { id: 8,  name: "Tiago Moreira",    nick: "Tiago",      status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 007", position: "Médio",    foot: "Ambos",
    age: 26, nationality: "🇵🇹 Portugal", club: "Boavista FC",
    attrs: { rit: 75, rem: 72, pas: 80, dri: 77, def: 70, fis: 74 },
    goals: 8,  assists: 9,  mvps: 1, gamesPlayed: 15 },
  { id: 9,  name: "Bruno Alves",      nick: "Brunão",     status: "pending",
    email: "", phone: "+351 913 000 008", position: "Avançado", foot: "Direito",
    age: 32, nationality: "🇵🇹 Portugal", club: "SL Benfica",
    attrs: { rit: 76, rem: 82, pas: 64, dri: 74, def: 45, fis: 83 },
    goals: 11, assists: 3,  mvps: 1, gamesPlayed: 8 },
  { id: 10, name: "Fábio Gomes",      nick: "Fábio",      status: "pending",
    email: "", phone: "+351 913 000 009", position: "Defesa",   foot: "Direito",
    age: 24, nationality: "🇵🇹 Portugal", club: "Rio Ave FC",
    attrs: { rit: 70, rem: 50, pas: 68, dri: 62, def: 78, fis: 76 },
    goals: 1,  assists: 4,  mvps: 0, gamesPlayed: 7 },
  { id: 11, name: "Ricardo Santos",   nick: "Ricardão",   status: "pending",
    email: "", phone: "+351 913 000 010", position: "Médio",    foot: "Esquerdo",
    age: 35, nationality: "🇵🇹 Portugal", club: "FC Porto",
    attrs: { rit: 65, rem: 75, pas: 83, dri: 78, def: 62, fis: 66 },
    goals: 6,  assists: 7,  mvps: 1, gamesPlayed: 13 },
  { id: 12, name: "Hugo Costa",       nick: "Hugo",       status: "pending",
    email: "", phone: "+351 913 000 011", position: "Avançado", foot: "Direito",
    age: 22, nationality: "🇨🇻 Cabo Verde", club: "Sporting CP",
    attrs: { rit: 90, rem: 80, pas: 62, dri: 84, def: 35, fis: 72 },
    goals: 14, assists: 2,  mvps: 2, gamesPlayed: 11 },
  { id: 13, name: "Nuno Alves",       nick: "Nuno",       status: "pending",
    email: "", phone: "+351 913 000 012", position: "Guarda-redes", foot: "Direito",
    age: 29, nationality: "🇵🇹 Portugal", club: "Gil Vicente FC",
    attrs: { rit: 55, rem: 38, pas: 60, dri: 48, def: 82, fis: 78 },
    goals: 0,  assists: 1,  mvps: 1, gamesPlayed: 6 },
  { id: 14, name: "Filipe Rodrigues", nick: "Filipe",     status: "declined",
    email: "", phone: "+351 913 000 013", position: "Defesa",   foot: "Direito",
    age: 34, nationality: "🇵🇹 Portugal", club: "CD Aves",
    attrs: { rit: 60, rem: 48, pas: 64, dri: 55, def: 75, fis: 72 },
    goals: 2,  assists: 3,  mvps: 0, gamesPlayed: 4 },
  { id: 15, name: "Gonçalo Ferreira", nick: "Gonças",     status: "declined",
    email: "", phone: "+351 913 000 014", position: "Médio",    foot: "Esquerdo",
    age: 23, nationality: "🇦🇴 Angola", club: "SL Benfica",
    attrs: { rit: 74, rem: 68, pas: 76, dri: 80, def: 58, fis: 64 },
    goals: 4,  assists: 2,  mvps: 0, gamesPlayed: 3 },
];

// Organizer-configurable group settings (defaults for the demo).
export const DEFAULT_SETTINGS = {
  groupName:    "FC Amigos",
  venue:        "PITCH Club — Campo 1",
  weekday:      6,        // 0=Domingo … 6=Sábado
  time:         "20:00",
  monthlyPrice: 80,       // € per month for the whole group
  maxPlayers:   10,
};

export const LAST_GAME = {
  date: "7 Jun", result: "5–3",
  scorers: [{ playerId: 2, goals: 2 }, { playerId: 6, goals: 2 }, { playerId: 1, goals: 1 }],
};

export const HISTORY = [
  { id: 1, date: "7 Jun",  confirmed: 10, result: "5–3", allPaid: true,  mvpId: 2 },
  { id: 2, date: "31 Mai", confirmed: 10, result: "3–3", allPaid: true,  mvpId: 4 },
  { id: 3, date: "24 Mai", confirmed: 9,  result: "4–2", allPaid: false, mvpId: 1 },
  { id: 4, date: "17 Mai", confirmed: 10, result: "6–1", allPaid: true,  mvpId: 6 },
  { id: 5, date: "10 Mai", confirmed: 10, result: "2–4", allPaid: true,  mvpId: 3 },
];

export const INITIAL_MATERIAL = [
  { id: 1, item: "Bola",        assignedTo: 2,    done: true  },
  { id: 2, item: "Coletes",     assignedTo: 1,    done: false },
  { id: 3, item: "Bomba de ar", assignedTo: null, done: false },
];

export const TOTAL_GAMES = 15;
export const POSITIONS = ["Guarda-redes", "Defesa", "Médio", "Avançado"];
export const FEET = ["Direito", "Esquerdo", "Ambos"];

export const NATIONALITIES = [
  "🇵🇹 Portugal", "🇧🇷 Brasil", "🇦🇴 Angola", "🇨🇻 Cabo Verde", "🇲🇿 Moçambique",
  "🇬🇼 Guiné-Bissau", "🇸🇹 São Tomé", "🇪🇸 Espanha", "🇫🇷 França", "🇮🇹 Itália",
  "🇩🇪 Alemanha", "🇬🇧 Inglaterra", "🇦🇷 Argentina", "🇺🇾 Uruguai", "🇺🇦 Ucrânia", "🌍 Outro",
];

export const CLUBS = [
  "FC Porto", "SL Benfica", "Sporting CP", "SC Braga", "Vitória SC", "Boavista FC",
  "Real Madrid", "Barcelona", "Man. United", "Liverpool", "Flamengo", "Outro",
];

// ── Court bookings (the club's 2 courts; hour slots per day) ──
export const COURT_HOURS = ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];

export const INITIAL_BOOKINGS = [
  { id: 1, court: 1, date: isoDay(0), hour: "19:00", groupName: "Os Galácticos" },
  { id: 2, court: 2, date: isoDay(0), hour: "21:00", groupName: "Várzea FC" },
  { id: 3, court: 1, date: isoDay(1), hour: "20:00", groupName: "Os Intocáveis" },
  { id: 4, court: 1, date: isoDay(1), hour: "21:00", groupName: "Os Intocáveis" },
  { id: 5, court: 2, date: isoDay(2), hour: "19:00", groupName: "FC Lapa" },
  { id: 6, court: 1, date: isoDay(3), hour: "22:00", groupName: "Os Galácticos" },
  { id: 7, court: 2, date: isoDay(4), hour: "20:00", groupName: "Várzea FC" },
];

// ── Club events (broadcasts, pop-ups, sales…) with RSVP + payment ──
export const CLUB_EVENTS = [
  { id: 1, emoji: "📺", title: "Final da Champions — ecrã gigante", date: isoDay(3),  time: "20:00",
    desc: "Transmissão no lounge com som de estádio. Reserva mesa para o teu grupo.",
    kind: "mesa", price: 20, going: 18, myStatus: null },
  { id: 2, emoji: "🍔", title: "Pop-up: Smash burgers do Mané", date: isoDay(5),  time: "19:00",
    desc: "Food pop-up na esplanada, das 19h até esgotar. Entrada livre.",
    kind: null, price: 0, going: 31, myStatus: null },
  { id: 3, emoji: "👕", title: "Feira de camisolas retro", date: isoDay(8),  time: "15:00",
    desc: "Compra, venda e troca de camisolas clássicas. Traz as tuas relíquias.",
    kind: "bilhete", price: 3, going: 12, myStatus: null },
  { id: 4, emoji: "🏆", title: "Mundial — jogos de Portugal", date: isoDay(12), time: "17:00",
    desc: "Todos os jogos de Portugal no ecrã gigante. Mesa reservada por jogo.",
    kind: "mesa", price: 15, going: 24, myStatus: null },
];

// ── Open matches ("falta 1!") — games from any group with free spots ──
export const OPEN_MATCHES = [
  { id: 1, groupName: "Várzea FC",      court: "Campo 2", date: isoDay(1), time: "21:00", spotsLeft: 2, level: "Casual",      price: 4,   joined: false },
  { id: 2, groupName: "Os Galácticos",  court: "Campo 1", date: isoDay(2), time: "19:00", spotsLeft: 1, level: "Competitivo", price: 5,   joined: false },
  { id: 3, groupName: "Os Intocáveis",  court: "Campo 2", date: isoDay(4), time: "20:00", spotsLeft: 3, level: "Casual",      price: 4.5, joined: false },
];

// Social feed starts empty — real posts from real members.
export const INITIAL_POSTS = [];
