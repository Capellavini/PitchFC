import React,{useEffect,useState} from 'react';
import type {PhoneRecorder} from './recorder';
export function CameraControls({engine,cameraId,onCamera,onSwitch,onError,disabled}:{engine:PhoneRecorder;cameraId?:string;onCamera:(id:string)=>void;onSwitch:()=>Promise<void>;onError:(s:string)=>void;disabled:boolean}){
  const z=engine.zoom;const [value,setValue]=useState(z?.value??1),[adjusting,setAdjusting]=useState(false);
  useEffect(()=>setValue(z?.value??1),[z?.value,engine.cameraId]);
  async function apply(v=value){
    if(adjusting||disabled)return;
    setAdjusting(true);
    try{await engine.setZoom(v);}catch(e){onError((e as Error).message);setValue(engine.zoom?.value??1);}finally{setAdjusting(false);}
  }
  if(engine.settings.demo)return <p className="hint">Zoom e lentes ficam disponíveis ao usar a câmera real do celular.</p>;
  return <div className="camera-controls"><strong>Enquadrar o campo</strong>
    {z?<><label>Zoom · {value.toFixed(2).replace(/0$/,'')}×<input aria-label="Zoom da câmera" type="range" min={z.min} max={z.max} step={z.step} value={value} disabled={disabled||adjusting} onChange={e=>setValue(Number(e.target.value))} onPointerUp={e=>void apply(Number(e.currentTarget.value))} onKeyUp={e=>void apply(Number(e.currentTarget.value))}/></label>
      <div className="two-buttons"><button className="secondary" disabled={disabled||adjusting} onClick={()=>void apply(z.min)}>Mais aberto · {z.min}×</button><button className="secondary" disabled={disabled||adjusting} onClick={()=>void apply()}>{adjusting?'Ajustando…':'Aplicar zoom'}</button></div>
      <p className="hint">O ajuste vale para a gravação e os replays. Zoom pode reduzir a nitidez.</p></>:<p className="hint">Este navegador não disponibiliza ajuste de zoom nesta câmera. Experimente outra lente abaixo, se disponível.</p>}
    {engine.cameras.length>1&&<><label>Câmera / lente disponível<select aria-label="Câmera ou lente" value={cameraId??engine.cameraId} disabled={disabled||adjusting} onChange={e=>onCamera(e.target.value)}>{engine.cameras.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <button className="secondary" disabled={disabled||adjusting||!cameraId||cameraId===engine.cameraId} onClick={()=>void onSwitch()}>Aplicar câmera · reiniciar histórico</button>
      <p className="hint">Trocar de câmera encerra a captura atual e inicia outra. Os lances salvos permanecem; o histórico anterior é reiniciado.</p></>}
    <p className="hint">Grande angular / 0,5× só aparece se o celular e o navegador liberarem essa lente. Os nomes são informados pelo aparelho. Confira a prévia antes de entrar no modo de campo.</p>
  </div>;
}
