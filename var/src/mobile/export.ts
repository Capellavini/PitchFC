import type { LocalClip } from './model';
import {asset,coreAsset,PUBLIC_VAR} from './paths';
// Discreet Pitch logo for the bottom-right corner (white, ~80% opacity, soft shadow so it reads on grass and sky).
async function watermark():Promise<Uint8Array|undefined>{
  try{
    const img=new Image();img.src=asset('brand/pitch-logo.png');await img.decode();
    const w=96,h=Math.round(w*img.naturalHeight/img.naturalWidth),pad=6;
    const canvas=document.createElement('canvas');canvas.width=w+pad*2;canvas.height=h+pad*2;
    const ctx=canvas.getContext('2d')!;ctx.globalAlpha=.8;ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=4;ctx.drawImage(img,pad,pad,w,h);
    const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/png'));
    return blob?new Uint8Array(await blob.arrayBuffer()):undefined;
  }catch{return undefined;}
}
export async function exportMP4(clip:LocalClip,onProgress:(n:number)=>void):Promise<Blob>{
  const {FFmpeg}=await import('@ffmpeg/ffmpeg');const ff=new FFmpeg();
  let log='';ff.on('log',e=>{log=(log+e.message+'\n').slice(-2000);});
  ff.on('progress',e=>onProgress(Math.min(99,Math.max(0,Math.round(e.progress*100)))));
  try{
    await ff.load({coreURL:new URL(coreAsset('ffmpeg-core.js'),location.href).href,wasmURL:new URL(coreAsset('ffmpeg-core.wasm'),location.href).href});
    const entries=[];
    for(let i=0;i<clip.parts.length;i++){
      const part=clip.parts[i],name=`part-${i}.${part.blob.type.includes('mp4')?'mp4':'webm'}`;
      await ff.writeFile(name,new Uint8Array(await part.blob.arrayBuffer()));entries.push(`file '${name}'\nduration ${part.end-part.start}`);
    }
    await ff.writeFile('parts.txt',entries.join('\n'));
    const start=Math.max(0,clip.start-clip.parts[0].start),duration=clip.end-clip.start;
    // The watermark never blocks an export: if the logo can't load, the clip goes out without it.
    const wm=PUBLIC_VAR?undefined:await watermark();if(wm)await ff.writeFile('wm.png',wm);
    const video=wm?['-filter_complex','[0:v:0]scale=854:-2[v];[v][1:v]overlay=W-w-10:H-h-8[out]','-map','[out]']:['-map','0:v:0','-vf','scale=854:-2'];
    const code=await ff.exec(['-f','concat','-safe','0','-i','parts.txt',...(wm?['-i','wm.png']:[]),'-ss',String(start),'-t',String(duration),...video,'-map','0:a:0?',
      '-c:v','libx264','-threads','1','-preset','ultrafast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','replay.mp4'],120000);
    if(code!==0)throw Error(`Não foi possível preparar o MP4. ${log.slice(-300)}`);
    const data=await ff.readFile('replay.mp4');if(typeof data==='string')throw Error('Arquivo de vídeo inválido.');
    onProgress(100);return new Blob([new Uint8Array(data)],{type:'video/mp4'});
  }finally{ff.terminate();}
}
