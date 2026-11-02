import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldHoldMountainGate,MOUNTAIN_PORTAL} from '../src/systems/ExpeditionRules.js';
import {bossAttackStep,bossAttackCadence} from '../src/systems/MountainCombat.js';

const gatePoint={x:MOUNTAIN_PORTAL.x-1,y:MOUNTAIN_PORTAL.y,z:MOUNTAIN_PORTAL.z};
test('a passagem segura o voo enquanto o módulo ainda está carregando',()=>{
  assert.equal(shouldHoldMountainGate(gatePoint,true,true,false),true);
  assert.equal(shouldHoldMountainGate({...gatePoint,x:MOUNTAIN_PORTAL.x-5},true,true,false),true);
  assert.equal(shouldHoldMountainGate({...gatePoint,x:465},true,true,false),false);
});
test('passagem livre com mapa pronto, sem montaria ou sem fogo',()=>{
  assert.equal(shouldHoldMountainGate(gatePoint,true,true,true),false);
  assert.equal(shouldHoldMountainGate(gatePoint,false,true,false),false);
  assert.equal(shouldHoldMountainGate(gatePoint,true,false,false),false);
  assert.equal(shouldHoldMountainGate({...gatePoint,z:300},true,true,false),false);
});
test('o chefe não dispara instantaneamente sem indicar perigo',()=>{
  const initial={elapsed:0,warned:false};
  const a=bossAttackStep(initial,.1,{active:true,health:12});
  assert.equal(a.fire,false);assert.equal(a.warn,false);assert.equal(a.charging,false);
});
test('ataque tem aviso antes do disparo e intervalo definido',()=>{
  let s={elapsed:0,warned:false},warning=false,shot=false;
  for(let i=0;i<90;i++){
    const result=bossAttackStep(s,.1,{active:true,health:12});
    s=result.state;
    if(result.warn){warning=true;assert.equal(result.fire,false);}
    if(result.fire){assert.ok(warning,'chefe disparou sem aviso');shot=true;break;}
  }
  assert.equal(shot,true);
});
test('segundo estágio do chefe aumenta a cadência sem disparos instantâneos',()=>{
  assert.ok(bossAttackCadence(5)<bossAttackCadence(12));
  assert.ok(bossAttackCadence(1)>1.8);
});
test('fora de alcance o chefe reinicia temporizador e aviso',()=>{
  const interrupted=bossAttackStep({elapsed:3.2,warned:true},.05,{active:false,health:2});
  assert.deepEqual(interrupted.state,{elapsed:0,warned:false});
  assert.equal(interrupted.fire,false);assert.equal(interrupted.charging,false);
});
test('contagem extrema e valores inválidos não geram rajadas em um só quadro',()=>{
  const result=bossAttackStep({elapsed:0,warned:false},200,{active:true,health:1});
  assert.equal(result.fire,false);
  assert.ok(result.state.elapsed<.1);
});
test('a lógica da passagem é integrada à atualização do mapa',()=>{
  const code=readFileSync(new URL('../src/game/Game.js',import.meta.url),'utf8');
  assert.match(code,/shouldHoldMountainGate\(/);
  assert.match(code,/bossAttackStep\(/);
  assert.match(code,/this\.mountain\?\.setBossWarning/);
});
test('barcos danificados mudam visual de forma coerente e independente da missão',()=>{
  const code=readFileSync(new URL('../src/world/MountainRegion.js',import.meta.url),'utf8');
  assert.match(code,/boatSails/);
  assert.match(code,/boatHealth\[i\]/);
});
