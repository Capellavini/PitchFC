// Todos os arquivos e o worker ficam na subpasta do VAR, sem controlar o restante do Pitch.
export const BASE = import.meta.env?.BASE_URL ?? '/';
export const PUBLIC_VAR = import.meta.env?.VITE_VAR_PUBLIC === 'true';
export const asset = (name: string) => BASE + name;
export const OFFLINE_CACHE = 'pitch-var-offline-v3-' + BASE;
// Processador ffmpeg (~32 MB). Padrão: arquivos locais em <BASE>media-core/ (build integrado /VAR).
// Com VITE_FFMPEG_CORE_BASE no build (ex.: Storage público do Supabase), carrega dessa URL absoluta.
const CORE_BASE: string = import.meta.env?.VITE_FFMPEG_CORE_BASE ?? '';
export const coreAsset = (name: string) => CORE_BASE ? CORE_BASE.replace(/\/?$/, '/') + name : asset('media-core/' + name);
