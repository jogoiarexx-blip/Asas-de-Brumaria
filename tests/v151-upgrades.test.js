import test from 'node:test';
import assert from 'node:assert/strict';
import {SaveSystem,normalizeSave} from '../src/systems/SaveSystem.js';
import {AudioSystem} from '../src/systems/Audio.js';
import {IslandActivities,ISLAND_TASKS,activityAllowed} from '../src/systems/IslandActivities.js';
import {LANDMARKS} from '../src/systems/Discovery.js';

function storage(){
  const values=new Map();
  return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),
    removeItem:k=>values.delete(k)};
}
const sample={
  version:1,layoutVersion:2,mission:{stage:2,progress:1},
  progression:{},player:{x:8,y:8,z:7,heroX:2,heroZ:11},
  islandActivities:{completed:[true,false,false,false,false,false,false]}
};
test('backup JSON preserva missões e atividades e pode ser importado',()=>{
  const store=storage(),save=new SaveSystem(store);
  assert.equal(save.write(sample),true);
  const json=save.exportBackup();
  assert.match(json,/asas-de-brumaria-save/);
  const replacement=new SaveSystem(storage());
  assert.deepEqual(replacement.importBackup(json),{ok:true,stage:2});
  assert.equal(replacement.read().mission.progress,1);
  assert.deepEqual(replacement.read().islandActivities.completed,[true,false,false,false,false,false,false]);
});
test('arquivo inválido não altera o save original',()=>{
  const store=storage(),save=new SaveSystem(store);
  save.write(sample);
  const before=store.getItem(save.key);
  assert.equal(save.importBackup('not json').ok,false);
  assert.equal(save.importBackup(JSON.stringify({format:'asas-de-brumaria-save',data:{}})).ok,false);
  assert.equal(save.importBackup(' '.repeat(524289)).ok,false);
  assert.equal(store.getItem(save.key),before);
});
test('importação válida preserva cópia de segurança anterior',()=>{
  const store=storage(),save=new SaveSystem(store);
  save.write({...sample,mission:{stage:0,progress:0}});
  const json=JSON.stringify({format:'asas-de-brumaria-save',data:sample});
  assert.equal(save.importBackup(json).ok,true);
  assert.equal(JSON.parse(store.getItem(save.key+'-backup')).mission.stage,0);
});
test('saves antigos inicializam as sete atividades vazias',()=>{
  const old=normalizeSave({...sample,islandActivities:undefined});
  assert.deepEqual(old.islandActivities.completed,[false,false,false,false,false,false,false]);
});
test('sete desafios exclusivos aceitam requisitos de voo e solo',()=>{
  assert.equal(ISLAND_TASKS.length,7);
  const activities=new IslandActivities();
  const first=LANDMARKS[0];
  const accepted=activities.tryComplete({x:first.x,y:12,z:first.z},{mounted:false,ground:12});
  assert.equal(accepted.ok,true);
  assert.equal(activities.total,1);
  assert.equal(activities.tryComplete({x:first.x,y:12,z:first.z},{mounted:false}),null);
  const farol=LANDMARKS[2],where={x:farol.x,y:43,z:farol.z};
  assert.equal(activities.tryComplete(where,{mounted:true,airborne:false,ground:10}).ok,false);
  assert.equal(activities.tryComplete(where,{mounted:true,airborne:true,speed:23,ground:10}).ok,true);
  const restored=new IslandActivities(activities.snapshot());
  assert.equal(restored.total,2);
  assert.equal(activityAllowed('glide',{mounted:true,airborne:true,speed:10}),true);
  assert.equal(activityAllowed('boost',{mounted:true,airborne:true,speed:12}),false);
});
test('volume de áudio aplica limite e separa os três grupos',()=>{
  const audio=new AudioSystem();
  assert.equal(audio.setVolume('ambience',.2,false),true);
  assert.equal(audio.setVolume('effects',1.5,false),true);
  assert.equal(audio.setVolume('interface',-2,false),true);
  assert.deepEqual(audio.volumes,{effects:1,ambience:.2,interface:0});
  assert.equal(audio.setVolume('unknown',.5,false),false);
});
