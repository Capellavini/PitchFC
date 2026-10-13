import type { LocalClip } from './model';
import {asset} from './paths';
export async function exportMP4(clip:LocalClip,onProgress:(n:number)=>void):Promise<Blob>{
  const {FFmpeg}=await import('@ffmpeg/ffmpeg');const ff=new FFmpeg();
  let log='';ff.on('log',e=>{log=(log+e.message+'\n').slice(-2000);});
  ff.on('progress',e=>onProgress(Math.min(99,Math.max(0,Math.round(e.progress*100)))));
  try{
    await ff.load({coreURL:new URL(asset('media-core/ffmpeg-core.js'),location.href).href,wasmURL:new URL(asset('media-core/ffmpeg-core.wasm'),location.href).href});
    const entries=[];
    for(let i=0;i<clip.parts.length;i++){
      const part=clip.parts[i],name=`part-${i}.${part.blob.type.includes('mp4')?'mp4':'webm'}`;
      await ff.writeFile(name,new Uint8Array(await part.blob.arrayBuffer()));entries.push(`file '${name}'\nduration ${part.end-part.start}`);
    }
    await ff.writeFile('parts.txt',entries.join('\n'));
    const start=Math.max(0,clip.start-clip.parts[0].start),duration=clip.end-clip.start;
    const code=await ff.exec(['-f','concat','-safe','0','-i','parts.txt','-ss',String(start),'-t',String(duration),'-map','0:v:0','-map','0:a:0?',
      '-vf','scale=854:-2','-c:v','libx264','-threads','1','-preset','ultrafast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','replay.mp4'],120000);
    if(code!==0)throw Error(`Não foi possível preparar o MP4. ${log.slice(-300)}`);
    const data=await ff.readFile('replay.mp4');if(typeof data==='string')throw Error('Arquivo de vídeo inválido.');
    onProgress(100);return new Blob([new Uint8Array(data)],{type:'video/mp4'});
  }finally{ff.terminate();}
}
