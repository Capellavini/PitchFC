import type { LocalClip } from './model';
import {PUBLIC_VAR} from './paths';
const NAME=PUBLIC_VAR?'pitch-var-mari-eder-mobile':'pitch-cam-mobile';
export const GALLERY_LIMIT=200*1024**2;
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{
  const r=indexedDB.open(NAME,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('clips',{keyPath:'id'});
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});
async function transaction<T>(mode:IDBTransactionMode,action:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await open();
  return new Promise((resolve,reject)=>{
    const t=db.transaction('clips',mode),r=action(t.objectStore('clips'));let value:T;
    r.onsuccess=()=>{value=r.result;};
    t.oncomplete=()=>{db.close();resolve(value);};
    t.onabort=t.onerror=()=>{db.close();reject(t.error||r.error||Error('Não foi possível salvar no armazenamento do navegador.'));};
  });
}
export async function listClips(){
  // A galeria guarda somente metadados em React. Blobs são lidos quando o usuário abre um replay.
  return (await transaction<LocalClip[]>('readonly',s=>s.getAll())).map(c=>({...c,parts:[]})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function loadClip(id:string){const clip=await transaction<LocalClip|undefined>('readonly',s=>s.get(id));if(!clip)throw Error('Replay não encontrado neste navegador.');return clip;}
export async function putClip(clip:LocalClip){
  const existing=await listClips();
  if(existing.filter(c=>c.id!==clip.id).reduce((n,c)=>n+c.bytes,0)+clip.bytes>GALLERY_LIMIT)throw Error('Galeria atingiu 200 MB. Exporte e exclua alguns lances para continuar.');
  await transaction('readwrite',s=>s.put(clip));
}
export async function deleteClip(id:string){await transaction('readwrite',s=>s.delete(id));}
