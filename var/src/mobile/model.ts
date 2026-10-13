import type {ReplayAssociation} from './matchday-var';
export interface Part { id:string; start:number; end:number; blob:Blob }
export interface LocalClip {
  id:string; createdAt:string; start:number; end:number; at:number;
  parts:Part[]; shortened:boolean; interrupted:boolean; bytes:number;
  state:'collecting'|'saved'|'failed'; error?:string; source:'button'|'voice'|'matchday';
  association?:ReplayAssociation;
  cloudUploaded?:boolean;
  cloudExpired?:boolean;
}
export function clipWindow(at:number, pre=20, post=10, earliest=0) {
  return {start:Math.max(earliest,at-pre),end:at+post,shortened:at-pre<earliest};
}
export function overlaps(part:Pick<Part,'start'|'end'>,clip:Pick<LocalClip,'start'|'end'>) {return part.end>clip.start&&part.start<clip.end;}
export function retained(parts:Part[],pending:LocalClip[],now:number,seconds=45,maxBytes=24*1024**2) {
  let bytes=parts.reduce((n,p)=>n+p.blob.size,0);
  const kept=parts.filter(p=>{
    const protect=pending.some(c=>c.state==='collecting'&&overlaps(p,c));
    if(!protect&&(p.end<now-seconds||bytes>maxBytes)){bytes-=p.blob.size;return false;}
    return true;
  });
  return {parts:kept,bytes,overflow:bytes>maxBytes};
}
export function phraseMatches(text:string,phrase:string) {
  const normalize=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim();
  return !!normalize(phrase)&&normalize(text)===normalize(phrase);
}
