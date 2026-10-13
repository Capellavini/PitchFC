export interface ZoomRange {min:number;max:number;step:number;value:number}
type ZoomCaps=MediaTrackCapabilities & {zoom?:{min:number;max:number;step?:number}};
type ZoomSettings=MediaTrackSettings & {zoom?:number};
export function cameraZoom(track:MediaStreamTrack):ZoomRange|undefined{
  const caps=track.getCapabilities?.() as ZoomCaps|undefined;
  const z=caps?.zoom;
  if(!z||!Number.isFinite(z.min)||!Number.isFinite(z.max)||z.min<=0||z.max<=z.min)return;
  const step=typeof z.step==='number'&&Number.isFinite(z.step)&&z.step>0?z.step:0.1;
  const actual=(track.getSettings() as ZoomSettings).zoom;
  return {min:z.min,max:z.max,step,value:Math.min(z.max,Math.max(z.min,actual??z.min))};
}
export function clampZoom(value:number,range:ZoomRange){
  if(!Number.isFinite(value))throw Error('Zoom inválido.');
  const rounded=range.min+Math.round((value-range.min)/range.step)*range.step;
  return Math.min(range.max,Math.max(range.min,Number(rounded.toFixed(6))));
}
export async function applyCameraZoom(track:MediaStreamTrack,value:number){
  const range=cameraZoom(track);
  if(!range)throw Error('Este navegador não disponibiliza zoom nesta câmera.');
  const zoom=clampZoom(value,range);
  const current=track.getConstraints();
  const advanced=(current.advanced??[]).map(entry=>{const kept={...entry} as MediaTrackConstraintSet & {zoom?:number};delete kept.zoom;return kept;}).filter(entry=>Object.keys(entry).length>0);
  // Preserva resolução/fps; altera a imagem capturada, inclusive nos replays.
  await track.applyConstraints({...current,advanced:[...advanced,{zoom} as MediaTrackConstraintSet]});
  const actual=(track.getSettings() as ZoomSettings).zoom;
  if(actual===undefined)throw Error('O navegador não confirmou o ajuste de zoom.');
  return cameraZoom(track)!;
}
