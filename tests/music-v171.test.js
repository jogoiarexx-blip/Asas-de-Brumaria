import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MusicSystem,MUSIC_MOODS,MUSIC_CHORDS,MUSIC_SCALE,STEPS_PER_BAR,noteHz,musicMood,melodyWalker} from '../src/systems/Music.js';
const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');

/** AudioContext falso: conta nós criados e guarda o que foi agendado. */
function fakeAudio({volume=.6,muted=false,state='running'}={}){
  const made={osc:[],gain:0};
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({connect(target){return target;},disconnect(){},gain:param(),frequency:param(),delayTime:param()});
  const ctx={currentTime:10,state,
    createGain(){made.gain++;return node();},createBiquadFilter:node,createDelay:node,
    createOscillator(){const osc={...node(),type:'sine',started:null,stopped:null,start(t){this.started=t;},stop(t){this.stopped=t;}};made.osc.push(osc);return osc;}};
  return {audio:{ctx,muted,volumes:{music:volume},musicChannel:node()},made,ctx};
}

test('v1.7.1: clima da trilha — combate tem prioridade, depois voo, depois noite',()=>{
  assert.equal(musicMood({combat:true,flying:true,night:1}),'combate');
  assert.equal(musicMood({flying:true,night:1}),'voo');
  assert.equal(musicMood({night:.8}),'noite');
  assert.equal(musicMood({night:.2}),'vila');
  assert.equal(musicMood(),'vila');
});

test('v1.7.1: todos os acordes existem e a melodia fica na pentatônica, sem Math.random',()=>{
  for(const mood of Object.values(MUSIC_MOODS))for(const chord of mood.chords)assert.ok(MUSIC_CHORDS[chord],chord);
  assert.ok(Math.abs(noteHz(0,3)-146.83)<1e-9);assert.ok(Math.abs(noteHz(12,3)/noteHz(0,3)-2)<1e-9);
  const a=melodyWalker(7),b=melodyWalker(7);
  for(let i=0;i<200;i++){
    const note=a.next();assert.equal(note,b.next());
    assert.ok(MUSIC_SCALE.includes(((note%12)+12)%12),'nota fora da escala: '+note);
    assert.ok(note>=0&&note<=21);
  }
  assert.doesNotMatch(src('../src/systems/Music.js'),/Math\.random|new Audio\(|fetch\(|\.mp3|\.ogg/);
});

test('v1.7.1: agenda no relógio do áudio com antecedência curta e respeita o limite de vozes',()=>{
  const {audio,made,ctx}=fakeAudio();
  const music=new MusicSystem(audio);
  music.update('vila');
  assert.ok(made.osc.length>=4,'o primeiro compasso precisa de acordes e baixo');
  assert.ok(made.osc.every(o=>o.started>=ctx.currentTime&&o.started<ctx.currentTime+.7&&o.stopped>o.started));
  assert.ok(music.voices<=music.maxVoices);
  // Sem avanço do relógio nada novo é agendado (chamadas por quadro são baratas).
  const before=made.osc.length;music.update('vila');music.update('vila');
  assert.equal(made.osc.length,before);
  // Muitos quadros sem liberar vozes: o limite segura o total.
  for(let i=0;i<400;i++){ctx.currentTime+=.2;music.update('voo');}
  assert.ok(music.voices<=music.maxVoices);
});

test('v1.7.1: mudo, volume zero ou áudio suspenso não criam nenhum nó',()=>{
  for(const options of [{muted:true},{volume:0},{state:'suspended'}]){
    const {audio,made}=fakeAudio(options);
    new MusicSystem(audio).update('combate');
    assert.equal(made.osc.length,0);assert.equal(made.gain,0);
  }
});

test('v1.7.1: combate entra na colcheia seguinte; sair do combate espera meio compasso',()=>{
  const {audio}=fakeAudio();
  const music=new MusicSystem(audio);music.ensureBus();
  music.pending='vila';music.scheduleStep(0,10);assert.equal(music.mood,'vila');
  music.pending='combate';music.scheduleStep(3,10.5);assert.equal(music.mood,'combate');
  music.pending='voo';music.scheduleStep(5,11);assert.equal(music.mood,'combate');
  music.scheduleStep(STEPS_PER_BAR,12);assert.equal(music.mood,'voo');
});

test('v1.7.1: integração — canal próprio, controle de volume e painel avançado no fim do estábulo',()=>{
  const audio=src('../src/systems/Audio.js'),game=src('../src/game/Game.js'),html=src('../index.html');
  assert.match(audio,/this\.musicChannel=this\.ctx\.createGain\(\);this\.musicChannel\.connect\(master\)/);
  assert.match(audio,/group==='music'\?this\.musicChannel/);
  assert.match(game,/this\.music\.update\(musicMood\(/);
  assert.match(html,/id="audio-music"/);
  const order=['id="bond-list"','id="species-list"','id="skill-list"','id="stable-advanced-title"','id="hero-glb-import"','id="dragon-glb-import"','id="night-fury-glb-import"'].map(token=>html.indexOf(token));
  assert.ok(order.every(i=>i>0),'faltou algum painel do estábulo');
  assert.deepEqual(order,[...order].sort((a,b)=>a-b));
  assert.match(src('../src/entities/VillageNPCs.js'),/sprite\.userData\.npcLabel=true/);
});
