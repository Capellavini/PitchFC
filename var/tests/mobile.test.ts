import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clipWindow,retained,overlaps,phraseMatches,type Part,type LocalClip} from '../src/mobile/model.ts';
import {COMMANDS,FieldVoice} from '../src/mobile/voice.ts';
import {cameraZoom,clampZoom,applyCameraZoom} from '../src/mobile/camera.ts';

test('zoom respeita limites/passos, preserva fps e lê o valor aplicado na câmera',async()=>{
  let actual=1;let applied:MediaTrackConstraints|undefined;
  const track={getCapabilities:()=>({zoom:{min:0.5,max:4,step:0.5}}),getSettings:()=>({zoom:actual}),getConstraints:()=>({frameRate:{max:20},width:{ideal:854},advanced:[{zoom:1} as MediaTrackConstraintSet]}),applyConstraints:async(c:MediaTrackConstraints)=>{applied=c;actual=(c.advanced![0] as any).zoom;}} as unknown as MediaStreamTrack;
  assert.equal(clampZoom(9,cameraZoom(track)!),4);
  assert.equal(clampZoom(0.1,cameraZoom(track)!),0.5);
  assert.equal(clampZoom(1.7,cameraZoom(track)!),1.5);
  assert.equal((await applyCameraZoom(track,2.2)).value,2);
  assert.deepEqual(applied?.frameRate,{max:20});
  assert.deepEqual(applied?.width,{ideal:854});assert.equal(applied?.advanced?.length,1);
});
test('câmeras sem zoom não oferecem controle e falhas do aparelho são propagadas',async()=>{
  const track={getCapabilities:()=>({}),getSettings:()=>({})} as unknown as MediaStreamTrack;
  assert.equal(cameraZoom(track),undefined);
  await assert.rejects(()=>applyCameraZoom(track,2),/não disponibiliza/);
  const failed={getCapabilities:()=>({zoom:{min:1,max:4}}),getSettings:()=>({zoom:1}),getConstraints:()=>({}),applyConstraints:async()=>{throw Error('Sem permissão');}} as unknown as MediaStreamTrack;
  await assert.rejects(()=>applyCameraZoom(failed,2),/Sem permissão/);
});
test('janela móvel inclui antes/depois e sinaliza histórico incompleto',()=>{
  assert.deepEqual(clipWindow(35),{start:15,end:45,shortened:false});
  assert.deepEqual(clipWindow(8),{start:0,end:18,shortened:true});
  assert.deepEqual(clipWindow(100,20,10,85),{start:85,end:110,shortened:true});
});
test('histórico circular não acumula a partida inteira e protege coleta pendente',()=>{
  const parts:Part[]=Array.from({length:30},(_,i)=>({id:String(i),start:i*5,end:(i+1)*5,blob:new Blob(['abcd'])}));
  const ring=retained(parts,[],150,45);assert.ok(ring.parts.length<=10);assert.equal(ring.overflow,false);
  const c={start:60,end:160,state:'collecting'} as LocalClip;
  assert.ok(retained(parts,[c],150,45).parts.some(p=>p.start===60));
  assert.equal(overlaps({start:5,end:10},{start:10,end:30}),false);
});
test('teto de bytes descarta primeiro os trechos antigos e detecta excesso protegido',()=>{
  const parts:Part[]=[0,1,2].map(i=>({id:String(i),start:i*5,end:(i+1)*5,blob:new Blob(['1234567890'])}));
  assert.equal(retained(parts,[],15,45,20).bytes,20);
  assert.equal(retained(parts,[{start:0,end:30,state:'collecting'} as LocalClip],15,45,20).overflow,true);
});
test('três comandos exatos, português/inglês, acentos e pontuação; rejeita frases vagas',()=>{
  for(const text of ['Pitch, salve o lance!','PITCH RECORD THIS GOAL','Pitch, record this part.'])assert.ok(COMMANDS.some(p=>phraseMatches(text,p)));
  for(const text of ['gol','salve o lance','Pitch, não salve o lance','Pitch record this game','Pitch, salve o lance depois'])assert.equal(COMMANDS.some(p=>phraseMatches(text,p)),false);
});
test('escuta contínua aciona uma vez, não guarda transcrição e desliga explicitamente',()=>{
  class FakeRecognition {
    lang='';continuous=false;interimResults=false;onresult:any;onend:any;onerror:any;started=false;
    start(){this.started=true;}stop(){this.started=false;}abort(){this.started=false;}
  }
  const previousWindow=(globalThis as any).window,previousDocument=(globalThis as any).document;
  (globalThis as any).window={isSecureContext:true,SpeechRecognition:FakeRecognition};(globalThis as any).document={hidden:false};
  try{
    const voice=new FieldVoice();let count=0;voice.oncommand=()=>count++;voice.start('en-US');
    const r=voice.recognition as unknown as FakeRecognition;assert.equal(r.continuous,true);assert.equal(r.lang,'en-US');
    const event={resultIndex:0,results:[{isFinal:true,0:{transcript:'Pitch, record this goal'}}]};
    r.onresult(event);r.onresult(event);assert.equal(count,1);voice.stop();assert.equal(voice.enabled,false);assert.equal(voice.listening,false);assert.equal(r.started,false);
  }finally{(globalThis as any).window=previousWindow;(globalThis as any).document=previousDocument;}
});
