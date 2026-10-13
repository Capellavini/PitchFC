import React,{useEffect,useRef,useState} from 'react';
import {loadClip} from './storage';
import type {LocalClip} from './model';

// Decode one visible thumbnail at a time, only while capture/export/upload is idle.
let thumbnailQueue=Promise.resolve();
async function frame(clip:LocalClip,signal:AbortSignal):Promise<Blob|undefined>{
 if(signal.aborted)return;
 const source=await loadClip(clip.id);if(signal.aborted)return;
 const part=source.parts.find(p=>p.start<=source.start&&p.end>source.start)??source.parts[0];if(!part)return;
 const video=document.createElement('video'),url=URL.createObjectURL(part.blob);
 video.muted=true;video.playsInline=true;video.preload='metadata';
 try{
  await new Promise<void>((resolve,reject)=>{
   const done=(error?:Error)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);video.onloadeddata=null;video.onseeked=null;video.onerror=null;error?reject(error):resolve();};
   const abort=()=>done(new Error('Cancelled'));
   const timer=setTimeout(()=>done(new Error('Thumbnail timeout')),5000);
   signal.addEventListener('abort',abort,{once:true});
   video.onerror=()=>done(new Error('Unsupported preview'));
   video.onloadeddata=()=>{const target=Math.max(0,source.start-part.start+.1);if(target<.05)done();else video.currentTime=Math.min(target,Math.max(0,video.duration-.1));};
   video.onseeked=()=>done();video.src=url;video.load();
  });
  if(signal.aborted||!video.videoWidth)return;
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=Math.max(1,Math.round(320*video.videoHeight/video.videoWidth));
  canvas.getContext('2d')?.drawImage(video,0,0,canvas.width,canvas.height);
  return await new Promise<Blob|undefined>(resolve=>canvas.toBlob(blob=>resolve(blob??undefined),'image/jpeg',.7));
 }finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
export function ClipThumbnail({clip,disabled}:{clip:LocalClip;disabled:boolean}){
 const ref=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false),[src,setSrc]=useState('');
 useEffect(()=>{if(!ref.current)return;if(!('IntersectionObserver'in window)){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'80px'});observer.observe(ref.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!visible||disabled||clip.state!=='saved')return;
  const controller=new AbortController();let imageURL='';
  thumbnailQueue=thumbnailQueue.then(async()=>{try{const blob=await frame(clip,controller.signal);if(blob&&!controller.signal.aborted){imageURL=URL.createObjectURL(blob);setSrc(imageURL);}}catch{/* The replay stays accessible when a browser cannot decode a thumbnail. */}});
  return()=>{controller.abort();if(imageURL)URL.revokeObjectURL(imageURL);setSrc('');};
 },[clip.id,clip.state,visible,disabled]);
 return <span className="clip-thumbnail" ref={ref}>{src?<img src={src} alt=""/>:<span className="thumbnail-fallback" aria-hidden="true">↶</span>}<span className="thumbnail-play" aria-hidden="true">▶</span><span className="thumbnail-duration">{Math.max(0,clip.end-clip.start).toFixed(0)}s</span></span>;
}
