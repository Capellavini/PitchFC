import {useEffect,useRef,useState} from 'react';
import {inputStyle} from './visual/theme';
import BtnPrimary from './visual/BtnPrimary';
import BtnGhost from './visual/BtnGhost';
export default function LeagueFanSquadConfirm({squad,players,busy,error,onConfirm,onCancel}){
 const dialog=useRef(null),[cap,setCap]=useState(squad.captain_id||''),[vice,setVice]=useState(squad.vice_captain_id||'');
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>{if(el?.open)el.close();}},[]);
 const starters=squad.player_ids.filter(id=>!squad.reserve_ids.includes(id));const name=id=>players.find(p=>p.id===id)?.name||id;
 return <dialog className="lf-squad-dialog" ref={dialog} onCancel={e=>{e.preventDefault();if(!busy)onCancel()}} aria-labelledby="lf-confirm-title"><h2 id="lf-confirm-title">Escolhe quem lidera a equipa</h2><p>O capitão pontua a dobrar. O vice assume quando o capitão não joga.</p><form className="lf-form" onSubmit={e=>{e.preventDefault();if(cap&&vice&&cap!==vice)onConfirm(cap,vice)}}><label>Capitão<select style={inputStyle()} value={cap} required onChange={e=>setCap(e.target.value)}><option value="">Escolher titular</option>{starters.map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label><label>Vice-capitão<select style={inputStyle()} value={vice} required onChange={e=>setVice(e.target.value)}><option value="">Escolher outro titular</option>{starters.filter(id=>id!==cap).map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>{squad.reserve_ids.length>0&&<p>Suplentes, por ordem: {squad.reserve_ids.map(name).join(' · ')}</p>}{error&&<p role="alert">{error}</p>}<div className="lb-actions"><BtnPrimary type="submit" disabled={busy||!cap||!vice||cap===vice}>{busy?'A guardar…':'Confirmar e guardar'}</BtnPrimary><BtnGhost disabled={busy} onClick={onCancel}>Voltar às escolhas</BtnGhost></div></form></dialog>;
}
