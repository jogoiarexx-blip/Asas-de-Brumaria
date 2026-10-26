import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FRONTIER_ZONES,nearestFrontierObjective} from '../src/systems/FrontierRules.js';
const source=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('local frontier objective is hidden outside its own island radius',()=>{
 assert.equal(nearestFrontierObjective({x:8,z:7}),null);
 assert.equal(nearestFrontierObjective({x:Infinity,z:7}),null);
 assert.equal(nearestFrontierObjective(null),null);
 const near=nearestFrontierObjective({x:FRONTIER_ZONES[0].x,z:FRONTIER_ZONES[0].z});
 assert.equal(near.zone,'crystal');assert.equal(near.kind,'relic');
 assert.equal(near.label,'Fragmento de Quartzo');assert.equal(near.remaining,3);
});
test('relic navigation selects closest remaining marker and never paid objectives',()=>{
 const zone=FRONTIER_ZONES[0];const [x,z]=zone.markers[0];
 const a=nearestFrontierObjective({x,z});assert.equal(a.id,'crystal:0');
 const b=nearestFrontierObjective({x,z},{found:['crystal:0']});
 assert.notEqual(b.id,a.id);assert.equal(b.remaining,2);
 const done=nearestFrontierObjective({x,z},{found:new Set(['crystal:0','crystal:1','crystal:2'])});
 assert.equal(done,null,'no guidance after collecting all three and before combat unlock');
});
test('guardian is next challenge once relics are collected and combat unlocked',()=>{
 const zone=FRONTIER_ZONES[1],found=['ash:0','ash:1','ash:2'];
 const p={x:zone.x,z:zone.z};
 const notYet=nearestFrontierObjective(p,{found});
 assert.equal(notYet,null);
 const available=nearestFrontierObjective(p,{found,combatUnlocked:true});
 assert.equal(available.kind,'guardian');assert.equal(available.label,'Sentinela de Basalto');
 const finished=nearestFrontierObjective(p,{found,combatUnlocked:true,defeated:['ash']});
 assert.equal(finished,null);
 assert.deepEqual(nearestFrontierObjective(p,{found,combatUnlocked:true}),available);
});
test('secondary objective HUD does not override original expedition, training or village contracts',()=>{
 const ui=source('../src/ui/UI.js');
 assert.match(ui,/!game\.inMountain&&!game\.training\.active&&!contractTarget/);
 assert.match(ui,/mountainTarget\?\?game\.training\.waypoint\?\?contractTarget\?\?frontierTarget/);
 assert.match(ui,/frontierTarget\.kind==='relic'/);
 assert.match(ui,/game\.frontier\.activeGuardians/);
 assert.match(ui,/ctx\.lineTo\(x\+5,y\)/);
 const game=source('../src/game/Game.js');
 assert.match(game,/this\.frontier\.update\(dt,this\.elapsed,this\.dragon/);
 const activities=source('../src/systems/FrontierActivities.js');
 assert.match(activities,/objective\(position,combatUnlocked=false\)/);
 assert.match(activities,/nearestFrontierObjective\(position,/);
});
