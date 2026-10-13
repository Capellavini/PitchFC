// Todos os arquivos e o worker ficam na subpasta do VAR, sem controlar o restante do Pitch.
export const BASE = import.meta.env.BASE_URL;
export const asset = (name: string) => BASE + name;
export const OFFLINE_CACHE = 'pitch-var-offline-v3-' + BASE;
