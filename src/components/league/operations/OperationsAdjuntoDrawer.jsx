import {useEffect,useRef} from 'react';
import {adjuntoName} from '../../../lib/leagueAdjunto';
import {getLang} from '../../../lib/i18n';
import {X} from 'lucide-react';
import OperationsAdjuntoChat from './OperationsAdjuntoChat';
import {Action} from './OperationsOverview';
export default function OperationsAdjuntoDrawer({onClose,...props}){
 const panel=useRef(null);
 useEffect(()=>{const before=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';panel.current?.querySelector('textarea')?.focus();const key=e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const items=[...panel.current.querySelectorAll('button:not(:disabled),textarea:not(:disabled),a[href],input:not(:disabled)')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);before?.focus()}},[onClose]);
 return <div className="ops-drawer-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}><aside ref={panel} className="ops-drawer" role="dialog" aria-modal="true" aria-label="Chat do Adjunto"><div className="ops-card-head"><h2>{adjuntoName(getLang())}</h2><Action onClick={onClose}><X size={20}/>Fechar</Action></div><OperationsAdjuntoChat {...props}/><Action onClick={()=>props.onAction('sheet')}>Ferramentas e fichas</Action></aside></div>;
}
