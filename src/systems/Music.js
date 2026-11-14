/** v1.7.1 — Trilha generativa: acordes suaves + melodia pentatônica criados em
 * tempo real com Web Audio. Nenhum arquivo de áudio, nenhum download.
 *
 * Quatro climas: vila, voo, noite e combate. O clima muda na virada do
 * compasso (o combate entra na colcheia seguinte). Agendamento com antecedência
 * de 0,5 s no relógio do AudioContext: o ritmo não depende do FPS. */
export const MUSIC_MOODS=Object.freeze({
  vila:   Object.freeze({bpm:76, chords:['D','Bm','G','A'],   melody:.34,bassEvery:4,pad:'triangle',lead:'triangle',octave:5,level:1}),
  voo:    Object.freeze({bpm:98, chords:['D','A','Bm','G'],   melody:.62,bassEvery:4,pad:'triangle',lead:'triangle',octave:5,level:1.05}),
  noite:  Object.freeze({bpm:60, chords:['Bm','G','D','F#m'], melody:.18,bassEvery:8,pad:'sine',    lead:'sine',    octave:5,level:.85}),
  combate:Object.freeze({bpm:122,chords:['Bm','Bm','G','A'],  melody:.46,bassEvery:2,pad:'triangle',lead:'square',  octave:4,level:.95})
});
/** Tríades em semitons a partir de Ré (D=0). */
export const MUSIC_CHORDS=Object.freeze({D:[0,4,7],A:[7,11,14],G:[5,9,12],Bm:[9,12,16],'F#m':[4,7,11]});
/** Ré maior pentatônica: sempre consonante sobre os acordes acima. */
export const MUSIC_SCALE=Object.freeze([0,2,4,7,9]);
export const STEPS_PER_BAR=8;
const D3=146.83;
export const noteHz=(semitones,octave=3)=>D3*2**((octave-3)+semitones/12);
/** Clima a partir do estado do jogo; o combate tem prioridade. */
export function musicMood({combat=false,flying=false,night=0}={}){
  if(combat)return 'combate';
  if(flying)return 'voo';
  return night>.5?'noite':'vila';
}
/** Gerador determinístico (LCG próprio): a mesma partida soa parecida. */
export function melodyWalker(seed=20261114){
  let state=seed>>>0,index=7;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  return {
    random,
    /** Passo melódico curto (−2..+2 graus) preso a duas oitavas. */
    next(){
      index=Math.max(0,Math.min(9,index+Math.round(random()*4-2)));
      return MUSIC_SCALE[index%5]+12*Math.floor(index/5);
    }
  };
}

export class MusicSystem {
  constructor(audio){
    this.audio=audio;this.mood='vila';this.pending='vila';
    this.step=0;this.nextTime=0;this.voices=0;this.maxVoices=18;
    this.walker=melodyWalker();this.bus=null;this.started=false;
  }
  /** Cria o barramento uma única vez, depois que o áudio foi liberado. */
  ensureBus(){
    const ctx=this.audio.ctx;
    if(this.bus||!ctx||!this.audio.musicChannel)return !!this.bus;
    const input=ctx.createGain();input.gain.value=1;
    const tone=ctx.createBiquadFilter();tone.type='lowpass';tone.frequency.value=2300;
    const delay=ctx.createDelay(1);delay.delayTime.value=.36;
    const feedback=ctx.createGain();feedback.gain.value=.3;
    const wet=ctx.createGain();wet.gain.value=.24;
    input.connect(tone);tone.connect(this.audio.musicChannel);
    tone.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(this.audio.musicChannel);
    this.bus={input,tone,delay,feedback,wet};
    return true;
  }
  voice(frequency,start,duration,type,volume,attack=.02){
    const ctx=this.audio.ctx;
    if(this.voices>=this.maxVoices)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain();this.voices++;
    osc.type=type;osc.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+attack);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain).connect(this.bus.input);
    osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices=Math.max(0,this.voices-1);};
    osc.start(start);osc.stop(start+duration+.03);
  }
  scheduleStep(step,time){
    const inBar=step%STEPS_PER_BAR,bar=Math.floor(step/STEPS_PER_BAR);
    if(inBar===0||this.pending==='combate'||this.mood==='combate'&&this.pending!=='combate'&&inBar%4===0)this.mood=this.pending;
    const mood=MUSIC_MOODS[this.mood],stepSeconds=30/mood.bpm;
    const chord=MUSIC_CHORDS[mood.chords[bar%mood.chords.length]];
    if(inBar===0){
      const length=stepSeconds*STEPS_PER_BAR;
      for(let i=0;i<3;i++)this.voice(noteHz(chord[i],4),time,length+.5,mood.pad,.018*mood.level,.45);
    }
    if(inBar%mood.bassEvery===0)
      this.voice(noteHz(chord[0],2),time,stepSeconds*Math.min(mood.bassEvery,4)*.95,'triangle',.05*mood.level,.015);
    if(this.walker.random()<mood.melody){
      const hold=this.walker.random()<.3?2:1;
      this.voice(noteHz(this.walker.next(),mood.octave),time,stepSeconds*hold*1.15,mood.lead,
        (mood.lead==='square'?.011:.024)*mood.level,.012);
    }
    return stepSeconds;
  }
  /** Chamar uma vez por quadro. Barato: só agenda quando falta menos de 0,5 s. */
  update(mood='vila'){
    const ctx=this.audio.ctx;
    if(!ctx||ctx.state!=='running'||this.audio.muted||!(this.audio.volumes.music>0)||!this.ensureBus()){this.started=false;return;}
    if(MUSIC_MOODS[mood])this.pending=mood;
    const now=ctx.currentTime;
    // Aba em segundo plano, pausa ou primeira vez: recomeça no compasso.
    if(!this.started||this.nextTime<now-.6){this.nextTime=now+.08;this.step=Math.ceil(this.step/STEPS_PER_BAR)*STEPS_PER_BAR;this.started=true;}
    let guard=0;
    while(this.nextTime<now+.5&&guard++<8){
      this.nextTime+=this.scheduleStep(this.step,this.nextTime);this.step++;
    }
  }
}
