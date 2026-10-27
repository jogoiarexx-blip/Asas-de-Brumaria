import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioSystem} from '../src/systems/Audio.js';
import {pulseConfig,canCastPulse,targetsInPulse,PULSE_COOLDOWN} from '../src/systems/DragonPowers.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('each dragon species has distinct elemental power identity and fair energy cost',()=>{
 const ids=['furia_noite','furia_luz','nimbo','raio','brasa'];
 const powers=ids.map(id=>pulseConfig(id,0));
 assert.equal(new Set(powers.map(p=>p.name)).size,5);
 assert.equal(new Set(powers.map(p=>p.color)).size,5);
 for(const power of powers){assert.ok(power.radius>=30&&power.radius<=40);assert.ok(power.cost>=24&&power.cost<=36);}
 assert.ok(pulseConfig('brasa',3).cost<pulseConfig('brasa',0).cost);
 assert.ok(pulseConfig('brasa',3).damage>pulseConfig('brasa',0).damage);
 assert.equal(PULSE_COOLDOWN,6.8);
});
test('elemental pulse cannot fire from foot, in dialogue, before cooldown or without energy',()=>{
 const cfg=pulseConfig('raio');
 for(const args of [{riding:false,energy:100,cooldown:0},{riding:true,energy:100,cooldown:1},
   {riding:true,energy:cfg.cost-.01,cooldown:0},{riding:true,energy:100,cooldown:0,dialogue:true}]){
  assert.equal(canCastPulse(args,cfg).ok,false);
 }
 assert.equal(canCastPulse({riding:true,energy:cfg.cost,cooldown:0},cfg).ok,true);
});
test('pulse checks complete 3D distance and only hits active, living enemies',()=>{
 const origin={x:0,y:30,z:0},mk=(x,y,z,active=true,alive=true)=>({position:{x,y,z},active,alive});
 const targets=[mk(12,35,0),mk(0,65,0),mk(0,31,0,false),mk(4,31,0,true,false),mk(0,-30,0)];
 assert.deepEqual(targetsInPulse(origin,targets,34),[targets[0]]);
 assert.equal(targetsInPulse(origin,targets,0).length,0);
});
test('power input is deliberate and does not remove fire, dodge, stable or benchmark',()=>{
 const game=read('../src/game/Game.js');const html=read('../index.html');
 assert.match(game,/this\.input\.consume\('h'\)/);
 assert.match(game,/pulseChord/);
 assert.match(game,/this\.input\.consume\('f'\)\)this\.fire\(\)/);
 assert.match(game,/this\.input\.consume\('q'\)/);
 assert.match(game,/if\(!allowed\.ok\)/);
 assert.match(game,/this\.dragon\.energy-=config\.cost/);
 assert.match(game,/this\.pulseCooldown=PULSE_COOLDOWN/);
 assert.match(game,/this\.effects\.pulse\(origin,config\)/);
 assert.match(html,/data-tap="h"/);
 assert.match(html,/id="pulse-status"/);
});
test('elemental ring/effects are pooled and GPU-warmed, not instantiated on every hit',()=>{
 const effects=read('../src/systems/Effects.js');const warmup=read('../src/systems/GraphicsWarmup.js');
 assert.match(effects,/new THREE\.RingGeometry\(\.84,1,56\)/);
 assert.match(effects,/this\.pulseRing\.visible=false/);
 assert.match(effects,/this\.pulseTime=\.62/);
 assert.match(effects,/this\.burst\(position,'pulse',26\)/);
 assert.match(warmup,/game\.effects\.pulseRing/);
});
test('higher detail grass has real bent blades and keeps instancing and per-island palettes',()=>{
 const nature=read('../src/world/NatureGeometry.js'),world=read('../src/world/World.js');
 assert.match(nature,/const directions=\[0,Math\.PI\*2\/3,Math\.PI\*4\/3\]/);
 assert.match(nature,/positions\.push\(/);
 assert.match(world,/makeGrassTuftGeometry\(\)/);
 assert.match(world,/new THREE\.InstancedMesh\(geometry,material,count\)/);
 assert.match(world,/setColorAt\(placed,new THREE\.Color/);
 assert.match(world,/terrainColorGrain\(x,z,y,island\.seed,island\.biome\)/);
 assert.match(world,/terrainTextures\.register\(terrainKind\(island\),material,island\)/);
});
test('trees use irregular shared low-poly canopy geometries and per-instance bark tint',()=>{
 const nature=read('../src/world/NatureGeometry.js'),world=read('../src/world/World.js');
 assert.match(nature,/export function makeTreeCrownGeometry/);
 assert.match(nature,/geometry\.computeVertexNormals\(\)/);
 assert.match(world,/broadleafCrowns:\[makeTreeCrownGeometry\(1\.4,13\),makeTreeCrownGeometry\(1\.1,27\)\]/);
 assert.match(world,/t=>\[0xd8c6a4,0xc8b4a3/);
 assert.match(world,/this\.foliageByIsland\.get\(islandName\)\.push\(batch\)/);
});
test('water uses a detailed reusable wave texture and dynamic daylight without extra reflection passes',()=>{
 const world=read('../src/world/World.js');
 assert.match(world,/canvas\.width=384;canvas\.height=384/);
 assert.match(world,/this\.water=water/);
 assert.match(world,/this\.water\.material\.color\.setRGB/);
 assert.match(world,/this\.water\.material\.bumpScale/);
 assert.match(world,/this\.coastByIsland\.values\(\)/);
 assert.doesNotMatch(world,/new THREE\.WebGLRenderTarget/);
});
test('enemies telegraph shots with emissive eyes and patterned wings',()=>{
 const enemy=read('../src/entities/EnemyDragon.js');
 assert.match(enemy,/const charging=this\.state==='chase'&&this\.fireCooldown<\.65/);
 assert.match(enemy,/eye\.emissiveIntensity=charging/);
 assert.match(enemy,/const stripeGeo=new THREE\.PlaneGeometry/);
 assert.match(enemy,/this\.proxy\.visible/);
});

// Minimal WebAudio mock validates graph construction and voice management.
const automation=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
const node=()=>({connect(){return this;},disconnect(){},start(){},stop(){},gain:automation(),frequency:automation(),
  threshold:automation(),knee:automation(),ratio:automation(),attack:automation(),release:automation()});
class FakeAudioContext{
 constructor(){this.state='running';this.currentTime=1;this.sampleRate=8000;this.destination=node();this.closed=false;}
 createBuffer(_,frames){return {getChannelData:()=>new Float32Array(frames)};}
 createGain(){return node();}createDynamicsCompressor(){return node();}createBiquadFilter(){return node();}
 createBufferSource(){return node();}createOscillator(){return node();}
 resume(){return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}
}
test('wind and sea ambience are created only on unlock, no simulation/audio in menu',()=>{
 const before=globalThis.window;globalThis.window={AudioContext:FakeAudioContext};
 try{
  const audio=new AudioSystem();assert.equal(audio.ctx,null);
  audio.updateAmbience({speed:45,airborne:true});assert.equal(audio.ctx,null);
  audio.unlock();const ctx=audio.ctx;
  assert.ok(audio.ambience.wind.source&&audio.ambience.sea.source);
  audio.updateAmbience({speed:35,airborne:true,coastDistance:4,wind:.4,rain:.5,time:4});
  assert.equal(audio.ctx,ctx,'do not recreate AudioContext each frame');
  audio.muted=true;audio.updateAmbience({speed:60});audio.dispose();
  assert.equal(audio.ctx,null);assert.equal(ctx.closed,true);
 }finally{if(before===undefined)delete globalThis.window;else globalThis.window=before;}
});
test('layered sound effects use a shared compressor and never exceed the voice ceiling',()=>{
 const before=globalThis.window;globalThis.window={AudioContext:FakeAudioContext};
 try{
  const audio=new AudioSystem();audio.unlock();
  for(let i=0;i<20;i++)audio.play(i%2?'pulse':'fire','raio');
  assert.ok(audio.activeVoices<=audio.maxVoices);
  audio.muted=true;const voices=audio.activeVoices;audio.play('hit');assert.equal(audio.activeVoices,voices);
  audio.dispose();
 }finally{if(before===undefined)delete globalThis.window;else globalThis.window=before;}
});
