import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FRONTIER_ZONES,FRONTIER_MARKERS,markerId,normalizeFrontier,frontierVisible,frontierClaimable} from '../src/systems/FrontierRules.js';
import {normalizeSave} from '../src/systems/SaveSystem.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const exampleSave={version:1,mission:{stage:0,progress:0},progression:{points:0},player:{x:8,y:3,z:7}};

test('frontier adds exactly two original optional island campaigns with three flight targets each',()=>{
  assert.deepEqual(FRONTIER_ZONES.map(z=>z.id),['crystal','ash']);
  assert.equal(FRONTIER_MARKERS.length,6);
  assert.equal(new Set(FRONTIER_MARKERS).size,6);
  for(const zone of FRONTIER_ZONES){
    assert.equal(zone.markers.length,3);
    assert.ok(zone.reward>=2&&zone.guardianReward>=2);
    zone.markers.forEach(([x,z],i)=>{
      assert.equal(markerId(zone,i),zone.id+':'+i);
      assert.ok(Math.hypot(x-zone.x,z-zone.z)<48,'targets must be on their island');
    });
  }
});
test('flying objectives cannot be collected on foot, landed or from a long distance',()=>{
 const zone=FRONTIER_ZONES[0],position={x:zone.x,y:30,z:zone.z};
 const dragon={riding:true,airborne:true,group:{position:{...position}}};
 assert.equal(frontierClaimable(dragon,position),true);
 dragon.airborne=false;
 assert.equal(frontierClaimable(dragon,position),false);
 dragon.airborne=true;dragon.riding=false;
 assert.equal(frontierClaimable(dragon,position),false);
 dragon.riding=true;dragon.group.position.z+=10;
 assert.equal(frontierClaimable(dragon,position),false);
});
test('region visibility uses hysteresis to prevent flickering and unloads far areas',()=>{
 const zone=FRONTIER_ZONES[1];
 assert.equal(frontierVisible({x:zone.x,z:zone.z},zone),true);
 assert.equal(frontierVisible({x:zone.x+213,z:zone.z},zone,false),false);
 assert.equal(frontierVisible({x:zone.x+213,z:zone.z},zone,true),true);
 assert.equal(frontierVisible({x:zone.x+300,z:zone.z},zone,true),false);
});
test('frontier progress is sanitized, supports old saves and never duplicates tokens',()=>{
 const payload={found:['crystal:1','crystal:1','ash:2','invalid',123],
  defeated:['ash','ash','nope'],rewarded:['crystal','bad','crystal']};
 assert.deepEqual(normalizeFrontier(payload),{
   found:['crystal:1','ash:2'],defeated:['ash'],rewarded:['crystal']});
 const fresh=normalizeSave(exampleSave);
 assert.deepEqual(fresh.frontier,{found:[],defeated:[],rewarded:[]});
 const restored=normalizeSave({...exampleSave,frontier:payload});
 assert.deepEqual(restored.frontier,normalizeFrontier(payload));
 const resaved=normalizeSave({...restored});
 assert.deepEqual(resaved.frontier,restored.frontier);
});
test('frontier actors are GPU-instanced, lazy, pooled, with isolated original campaign',()=>{
 const implementation=read('../src/systems/FrontierActivities.js');
 const game=read('../src/game/Game.js'),ui=read('../src/ui/UI.js');
 assert.match(implementation,/new THREE\.InstancedMesh\(geometry/);
 assert.match(implementation,/new THREE\.InstancedMesh\(ringGeometry/);
 assert.match(implementation,/ensureGuardian\(zone\)/);
 assert.match(implementation,/new EnemyDragon\(/);
 assert.match(implementation,/if\(active\)guardian\.update\(/);
 assert.match(implementation,/guardian\.setActive\(active\)/);
 assert.match(game,/this\.frontier\.update\(/);
 assert.match(game,/this\.frontier\.hitGuardian\(/);
 assert.match(game,/this\.frontier\.snapshot\(\)/);
 assert.match(game,/this\.frontier\.restore\(data\.frontier\)/);
 assert.match(ui,/game\.frontier\.summary\(\)/);
});
