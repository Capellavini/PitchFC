// ─────────────────────────────────────────────────────────
// MOCK DATA (mirrors the Supabase schema in CLAUDE.md).
// This becomes the seed data when the backend lands.
// ─────────────────────────────────────────────────────────
export const INITIAL_GROUP = [
  { id: 1,  name: "Carlos Silva",     nick: "Carlão",     status: "confirmed", paid: true,  isMe: true,
    email: "carlos@email.com", phone: "+351 912 345 678", position: "Médio",    foot: "Direito",
    goals: 12, assists: 8,  mvps: 3, gamesPlayed: 13 },
  { id: 2,  name: "João Ferreira",    nick: "Joãozão",    status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 001", position: "Avançado", foot: "Direito",
    goals: 21, assists: 5,  mvps: 5, gamesPlayed: 15 },
  { id: 3,  name: "Miguel Santos",    nick: "Miguelinho", status: "confirmed", paid: false,
    email: "", phone: "+351 913 000 002", position: "Defesa",   foot: "Esquerdo",
    goals: 3,  assists: 11, mvps: 2, gamesPlayed: 11 },
  { id: 4,  name: "Rui Oliveira",     nick: "Ruizão",     status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 003", position: "Guarda-redes", foot: "Direito",
    goals: 0,  assists: 2,  mvps: 4, gamesPlayed: 14 },
  { id: 5,  name: "Diogo Costa",      nick: "Diogo",      status: "confirmed", paid: false,
    email: "", phone: "+351 913 000 004", position: "Médio",    foot: "Direito",
    goals: 9,  assists: 13, mvps: 1, gamesPlayed: 9 },
  { id: 6,  name: "André Lima",       nick: "Liminha",    status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 005", position: "Avançado", foot: "Esquerdo",
    goals: 17, assists: 4,  mvps: 2, gamesPlayed: 12 },
  { id: 7,  name: "Pedro Neves",      nick: "Pedão",      status: "confirmed", paid: false,
    email: "", phone: "+351 913 000 006", position: "Defesa",   foot: "Direito",
    goals: 2,  assists: 6,  mvps: 0, gamesPlayed: 10 },
  { id: 8,  name: "Tiago Moreira",    nick: "Tiago",      status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 007", position: "Médio",    foot: "Ambos",
    goals: 8,  assists: 9,  mvps: 1, gamesPlayed: 15 },
  { id: 9,  name: "Bruno Alves",      nick: "Brunão",     status: "pending",
    email: "", phone: "+351 913 000 008", position: "Avançado", foot: "Direito",
    goals: 11, assists: 3,  mvps: 1, gamesPlayed: 8 },
  { id: 10, name: "Fábio Gomes",      nick: "Fábio",      status: "pending",
    email: "", phone: "+351 913 000 009", position: "Defesa",   foot: "Direito",
    goals: 1,  assists: 4,  mvps: 0, gamesPlayed: 7 },
  { id: 11, name: "Ricardo Santos",   nick: "Ricardão",   status: "pending",
    email: "", phone: "+351 913 000 010", position: "Médio",    foot: "Esquerdo",
    goals: 6,  assists: 7,  mvps: 1, gamesPlayed: 13 },
  { id: 12, name: "Hugo Costa",       nick: "Hugo",       status: "pending",
    email: "", phone: "+351 913 000 011", position: "Avançado", foot: "Direito",
    goals: 14, assists: 2,  mvps: 2, gamesPlayed: 11 },
  { id: 13, name: "Nuno Alves",       nick: "Nuno",       status: "pending",
    email: "", phone: "+351 913 000 012", position: "Guarda-redes", foot: "Direito",
    goals: 0,  assists: 1,  mvps: 1, gamesPlayed: 6 },
  { id: 14, name: "Filipe Rodrigues", nick: "Filipe",     status: "declined",
    email: "", phone: "+351 913 000 013", position: "Defesa",   foot: "Direito",
    goals: 2,  assists: 3,  mvps: 0, gamesPlayed: 4 },
  { id: 15, name: "Gonçalo Ferreira", nick: "Gonças",     status: "declined",
    email: "", phone: "+351 913 000 014", position: "Médio",    foot: "Esquerdo",
    goals: 4,  assists: 2,  mvps: 0, gamesPlayed: 3 },
];

export const GROUP_NAME = "FC Amigos";

export const GAME = {
  label:     "Jogo dos Amigos",
  date:      "Sábado, 14 Jun",
  time:      "20:00",
  field:     "PITCH Club — Campo 1",
  spots:     10,
  totalCost: 80,
  recurring: "Todas as semanas · Sáb às 20:00",
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
export const INVITE_URL = "https://pitch.club/convite/fc-amigos";
