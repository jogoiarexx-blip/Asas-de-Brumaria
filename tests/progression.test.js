import test from 'node:test';
import assert from 'node:assert/strict';
import {Progression,SPECIES,SKILLS,REWARDS} from '../src/systems/Progression.js';
import {SaveSystem,normalizeSave} from '../src/systems/SaveSystem.js';
test('cinco espécies, Fúria da Noite inicial e sete recompensas de missão',()=>{
  assert.deepEqual(Object.keys(SPECIES),['furia_noite','nimbo','brasa','raio','furia_luz']);
  assert.equal(Object.keys(SKILLS).length,3);
  assert.equal(REWARDS.length,7);
});
test('progressão protege gastos, upgrades e limite de nível',()=>{
  const p=new Progression();
  assert.equal(p.upgrade('speed').ok,false);
  assert.equal(p.unlock('raio').ok,false);
  p.grant(50);
  assert.equal(p.upgrade('speed').ok,true);
  assert.equal(p.skills.speed,1);
  assert.equal(p.points,49);
  assert.equal(p.upgrade('speed').ok,true);assert.equal(p.points,47);
  assert.equal(p.upgrade('speed').ok,true);assert.equal(p.points,44);
  assert.equal(p.upgrade('speed').ok,false);
  assert.equal(p.unlock('raio').ok,true);
  assert.equal(p.points,41);
  assert.equal(p.unlock('raio').ok,false);
  assert.equal(p.select('raio'),true);
  assert.ok(p.stats.flightSpeed>31);
  assert.ok(p.stats.boostSpeed>49);
});
test('dano e gasto de fogo evoluem com upgrades',()=>{
  const p=new Progression();const before=p.stats;
  p.grant(6);p.upgrade('fire');p.upgrade('fire');p.upgrade('fire');
  assert.ok(p.stats.fireDamage>before.fireDamage);
  assert.ok(p.stats.fireCost<before.fireCost);
  assert.ok(p.stats.fireCooldown<before.fireCooldown);
});
test('restauração de evolução ignora espécies ilegais, moedas negativas e atributos fora do limite',()=>{
  const p=new Progression({points:-99,earned:0,species:'raio',unlocked:['especieFalsa'],skills:{speed:900,stamina:-4,fire:1},circuits:6});
  assert.deepEqual(p.unlocked,['furia_noite']);assert.equal(p.species,'furia_noite');
  assert.equal(p.points,0);assert.equal(p.skills.speed,3);assert.equal(p.skills.stamina,0);
  p.grant(9);p.unlock('brasa');p.select('brasa');
  const restored=new Progression(p.snapshot());assert.deepEqual(restored.snapshot(),p.snapshot());
});
test('save normaliza dados malformados sem posições infinitas',()=>{
  assert.equal(normalizeSave({version:5}),null);
  const save=normalizeSave({version:1,mission:{stage:99,progress:99,crystals:[true],targets:[],hatchlings:[],enemies:[4,-9,2]},progression:{points:5},player:{x:Infinity,y:-10,z:999,health:0,energy:10000,mounted:true,airborne:true}});
  assert.equal(save.mission.stage,7);assert.equal(save.mission.progress,0);
  assert.deepEqual(save.mission.enemies,[3,0,2]);
  assert.equal(save.player.x,8);assert.equal(save.player.z,640);assert.equal(save.player.health,1);assert.equal(save.player.energy,250);
  assert.equal(save.player.mounted,true);
  const partial=normalizeSave({version:1,mission:{stage:4,progress:1,enemies:[1.5,3,3]},progression:{}});
  assert.deepEqual(partial.mission.enemies,[1.5,3,3]);
});
test('save em armazenamento simulado restaura progresso e admite limpeza',()=>{
  const map=new Map();const storage={getItem:key=>map.get(key)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const repo=new SaveSystem(storage);
  const payload={version:1,mission:{stage:3,progress:2,crystals:[true,true,false],targets:[true,true,false],hatchlings:[],enemies:[3,3,3]},progression:new Progression().snapshot(),player:{x:50,y:32,z:20,energy:65,health:85,mounted:true,airborne:true}};
  assert.equal(repo.write(payload),true);
  assert.equal(repo.read().mission.stage,3);
  assert.equal(repo.read().player.mounted,true);
  assert.equal(repo.clear(),true);assert.equal(repo.read(),null);
});
test('armazenamento bloqueado não quebra jogo',()=>{
  const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}};
  const repo=new SaveSystem(storage);
  assert.equal(repo.read(),null);assert.equal(repo.write({}),false);assert.equal(repo.clear(),false);
});
