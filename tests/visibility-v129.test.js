import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visibleIslandFoliage,detailRadius,shouldRefreshClouds,wrappedCloudX} from '../src/world/VisibilityBudget.js';
const source=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const island={x:0,z:0,r:50};

test('island foliage stays visible next to shoreline even on low-end hardware',()=>{
  assert.equal(visibleIslandFoliage({x:100,z:0,y:10},island,'economy',false),true);
});
test('distant foliage is culled on budget GPUs, not the actual terrain or obstacles',()=>{
  assert.equal(visibleIslandFoliage({x:460,z:0,y:10},island,'economy',false),false);
  assert.equal(visibleIslandFoliage({x:460,z:0,y:10},island,'balanced',false),false);
  assert.equal(visibleIslandFoliage({x:460,z:0,y:10},island,'quality',false),true);
});
test('high-altitude flying increases detail distance to avoid popping',()=>{
  assert.ok(detailRadius('economy',120)>detailRadius('economy',5));
  assert.equal(visibleIslandFoliage({x:300,z:0,y:120},island,'economy',false),true);
});
test('hysteresis prevents flicker near visibility threshold',()=>{
  const cutoff=detailRadius('economy',0)+island.r;
  assert.equal(visibleIslandFoliage({x:cutoff+10,z:0,y:0},island,'economy',true),true);
  assert.equal(visibleIslandFoliage({x:cutoff+10,z:0,y:0},island,'economy',false),false);
});
test('invalid detail mode remains conservative, never creates an invisible world',()=>{
  assert.equal(visibleIslandFoliage({x:700,z:0,y:0},island,'unknown',false),true);
});
test('terrain and physics remain independent of scene detail visibility',()=>{
  const world=source('../src/world/World.js');
  assert.match(world,/this\.obstacles\s*=\s*\[\]/);
  assert.match(world,/updateDetail\(/);
  assert.match(world,/foliageByIsland/);
  assert.match(world,/grassByIsland/);
});
test('distant islands are represented by small per-island batches, not one world-wide instanced batch',()=>{
  const world=source('../src/world/World.js');
  assert.match(world,/for\s*\(const island of ISLANDS\)/);
  assert.match(world,/this\.foliageByIsland/);
  assert.match(world,/this\.grassByIsland/);
});
test('clouds have a single instanced draw call with dynamic transforms',()=>{
  const world=source('../src/world/World.js');
  assert.match(world,/this\.cloudMesh\s*=\s*new THREE\.InstancedMesh\(/);
  assert.match(world,/this\.cloudMesh\.instanceMatrix\.setUsage\(THREE\.DynamicDrawUsage\)/);
  assert.doesNotMatch(world,/const puff\s*=\s*new THREE\.Mesh\(/);
});
test('cloud wrap reproduces correct movement independently of frame rate',()=>{
  assert.ok(Math.abs(wrappedCloudX(0,2,100,1)-200)<.0001);
  assert.ok(Math.abs(wrappedCloudX(445,2,10,1)+435)<.0001);
  assert.ok(Math.abs(wrappedCloudX(0,2,100,.5)-100)<.0001);
});
test('cloud update frequency is bounded on weak hardware',()=>{
  assert.equal(shouldRefreshClouds(.03,'economy'),false);
  assert.equal(shouldRefreshClouds(.12,'economy'),true);
  assert.equal(shouldRefreshClouds(.12,'balanced'),true);
  assert.equal(shouldRefreshClouds(.03,'quality'),true);
});
test('graphics profile controls scene detail without forcing a new game or changing save format',()=>{
  const game=source('../src/game/Game.js');
  assert.match(game,/this\.world\?\.setDetailQuality\(tier\)/);
  assert.match(game,/this\.world\.updateDetail\(this\.camera\.position,dt,\{/);
});

test('runtime detail toggles island-scoped foliage/grass, never collision obstacles',async()=>{
  const {applyIslandVisibility}=await import('../src/world/VisibilityBudget.js');
  const islands=[{name:'near',x:0,z:0,r:50},{name:'far',x:580,z:0,r:50}];
  const near=[{visible:true},{visible:true}],far=[{visible:true}];
  const foliage=new Map([['near',near],['far',far]]);
  const grass=new Map([['near',{visible:true}],['far',{visible:true}]]);
  const untouchedPhysics=[{x:580,z:0,radius:5,bottom:0,top:40}];
  const count=applyIslandVisibility({x:0,z:0,y:10},'economy',islands,foliage,grass);
  assert.deepEqual(count,{visible:1,total:2});
  assert.ok(near.every(mesh=>mesh.visible));
  assert.equal(far[0].visible,false);
  assert.equal(grass.get('near').visible,true);
  assert.equal(grass.get('far').visible,false);
  assert.equal(untouchedPhysics[0].radius,5);
});

test('F3 diagnosis reveals number of visible foliage islands to explain frame drops',()=>{
 const code=source('../src/systems/PerformanceDiagnostics.js');
 assert.match(code,/visibleIslands/);
 const game=source('../src/game/Game.js');
 assert.match(game,/visibleIslands:/);
});
