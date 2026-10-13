import {phraseMatches} from './model';
export const COMMANDS=['Pitch, salve o lance','Pitch, record this goal','Pitch, record this part'];
type Result={isFinal:boolean;0:{transcript:string}};
interface Recognition {
  lang:string;continuous:boolean;interimResults:boolean;start:()=>void;stop:()=>void;abort:()=>void;
  onresult:((e:{resultIndex:number;results:ArrayLike<Result>})=>void)|null;
  onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null;
}
type VoiceWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export class FieldVoice {
  enabled=false;listening=false;recognition?:Recognition;timer?:ReturnType<typeof setTimeout>;last=-Infinity;failures=0;
  onchange=()=>{};oncommand=()=>{};onerror=(_message:string)=>{};
  supported(){const w=window as VoiceWindow;return !!(w.SpeechRecognition||w.webkitSpeechRecognition)&&window.isSecureContext;}
  start(lang='pt-BR'){
    this.stop();const w=window as VoiceWindow,C=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!C||!window.isSecureContext)throw Error('Escuta indisponível neste navegador. A câmera e o botão continuam disponíveis.');
    this.enabled=true;const r=new C();this.recognition=r;r.lang=lang;r.continuous=true;r.interimResults=false;
    r.onresult=e=>{
      for(let i=e.resultIndex??0;i<e.results.length;i++){
        const result=e.results[i];if(!result.isFinal)continue;
        if(COMMANDS.some(phrase=>phraseMatches(result[0].transcript,phrase))&&performance.now()-this.last>8000){this.last=performance.now();this.failures=0;this.oncommand();}
      }
    };
    r.onerror=e=>{
      this.listening=false;this.onchange();
      if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(e.error)){this.stop();this.onerror(`Voz indisponível (${e.error}). Use o botão de salvar.`);}
      else if(e.error==='network'){this.failures++;this.onerror('O serviço de voz perdeu conexão. A câmera continua gravando; confira o indicador de escuta.');}
    };
    r.onend=()=>{
      this.listening=false;this.onchange();
      if(this.enabled&&!document.hidden)this.timer=setTimeout(()=>this.listen(),Math.min(15000,800*2**this.failures));
    };
    this.listen();
  }
  private listen(){
    if(!this.enabled||document.hidden)return;
    try{this.recognition?.start();this.listening=true;this.onchange();}
    catch{this.listening=false;this.failures++;this.onchange();if(this.enabled)this.timer=setTimeout(()=>this.listen(),Math.min(15000,1000*2**this.failures));}
  }
  stop(){this.enabled=false;this.listening=false;clearTimeout(this.timer);if(this.recognition){this.recognition.onend=null;this.recognition.onerror=null;this.recognition.onresult=null;try{this.recognition.abort();}catch{}}this.onchange();}
}
