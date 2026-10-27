import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ObstacleGrid} from '../src/utils/ObstacleGrid.js';
import {obstacleCeiling,moveWithCollisions,recoverFreePosition,landmarkCollisionVolumes} from '../src/utils/collision.js';
import {moveFlightWithCollisions,resolveCameraPosition} from '../src/utils/spatialSweep.js';
import {safeDismountSpot} from '../src/utils/surfaces.js';
import {predictFlightIsland} from '../src/world/IslandFlightPrefetch.js';
import {IslandDetailStream} from '../src/world/IslandDetailStream.js';

const island=(name,x,z)=>({name,x,z,r:55});
const islands=[island('Refúgio',0,0),island('Farol',340,-70),island('Cinzas',-250,360)];
const bounds=(rng)=>rng()*600-300;
function deterministic(){let state=93431;return ()=>{state=Math.imul(state,1664525)+1013904223|0;return (state>>>0)/4294967296;};}

// Test shape-aware narrowphase and broadphase equality across random movements.
test('spatial grid finds identical candidates for 500 randomized point queries',()=>{
 const rand=deterministic();const obstacles=Array.from({length:1200},(_,i)=>({
  x:bounds(rand),z:bounds(rand),radius:1+rand()*8,bottom:0,top:10+i%13,
  type:i%4===0?'tree':'rock',
 }));
 obstacles.push(...landmarkCollisionVolumes(18,16,2));
 const grid=new ObstacleGrid(()=>obstacles);
 for(let i=0;i<500;i++){
  const x=bounds(rand),z=bounds(rand),r=rand()*12;
  assert.equal(obstacleCeiling(x,z,r,grid),obstacleCeiling(x,z,r,obstacles));
 }
 assert.ok(grid.stats.candidates<grid.stats.fullScanEquivalent*.18);
 assert.equal(grid.stats.rebuilds,1);
});

test('indexed walking and flying match legacy linear collisions and avoid tunneling',()=>{
 const rand=deterministic();
 const obstacles=Array.from({length:600},(_,i)=>({x:bounds(rand),z:bounds(rand),radius:1.2+rand()*4,
  bottom:0,top:12,type:i%5?'tree':'rock'}));
 const grid=new ObstacleGrid(()=>obstacles);
 for(let i=0;i<70;i++){
  const start={x:bounds(rand),z:bounds(rand)},delta={x:rand()*30-15,z:rand()*30-15};
  const walking=(source)=>moveWithCollisions(start,delta,.75,source,()=>true,()=>true);
  assert.deepEqual(walking(grid),walking(obstacles));
  const air=(source)=>moveFlightWithCollisions({...start,y:6},{...delta,y:0},1,1.5,source,()=>-3);
  assert.deepEqual(air(grid),air(obstacles));
 }
});

test('camera canopy, saved position recovery, dismount stay identical with indexed obstacles',()=>{
 const obstacles=[{x:4,z:0,radius:1.1,bottom:0,top:5,type:'tree'},
  {x:-3,z:4,radius:4,bottom:1,top:12,type:'cabin'},
  ...landmarkCollisionVolumes(3,5,0)];
 const grid=new ObstacleGrid(()=>obstacles,{cellSize:8});
 const camera=(source)=>resolveCameraPosition({x:0,y:9,z:0},{x:12,y:9,z:0},source,()=>-10);
 assert.deepEqual(camera(grid),camera(obstacles));
 const recover=(source)=>recoverFreePosition({x:4,z:0},.5,source,()=>true,()=>true);
 assert.deepEqual(recover(grid),recover(obstacles));
 const dismount=(source)=>safeDismountSpot({x:4,z:0},{obstacles:source,groundAt:()=>3});
 assert.deepEqual(dismount(grid),dismount(obstacles));
});

test('spatial grid refreshes after mountain objects are inserted and after array replacement',()=>{
 let obstacles=[{x:0,z:0,radius:2,top:4,bottom:0}];
 const grid=new ObstacleGrid(()=>obstacles);
 assert.equal(grid.queryCircle(0,0,2).length,1);
 obstacles.push({x:330,z:130,radius:5,top:14,bottom:0});
 assert.equal(grid.queryCircle(330,130,2).length,1);
 obstacles=obstacles.filter(o=>o.x===330);
 assert.equal(grid.queryCircle(0,0,2).length,0);
 assert.equal(grid.queryCircle(330,130,2).length,1);
 assert.equal(grid.stats.rebuilds,3);
});

test('flying toward an island preloads it; facing away or walking does not',()=>{
 const forward=predictFlightIsland({x:0,z:0},{x:1,z:0},45,islands);
 assert.equal(forward?.name,'Farol');
 assert.equal(predictFlightIsland({x:0,z:0},{x:-1,z:0},45,islands)?.name??null,null);
 assert.equal(predictFlightIsland({x:0,z:0},{x:1,z:0},8,islands),null);
 assert.equal(predictFlightIsland({x:0,z:0},{x:0,z:1},55,islands)?.name,'Cinzas');
});

test('predictive island prefetch queues only lightweight coast and foliage ahead',()=>{
 const calls=[];
 const stream=new IslandDetailStream(islands,{coast:i=>calls.push(i.name+'/coast'),
  foliage:i=>calls.push(i.name+'/foliage'),grass:i=>calls.push(i.name+'/grass'),
  flowers:i=>calls.push(i.name+'/flowers')});
 stream.markReady('Refúgio');
 const next=islands[1];
 stream.plan({x:0,y:0,z:0},'economy',{prefetchIsland:next});
 while(stream.pending)stream.step();
 assert.deepEqual(calls,['Farol/coast','Farol/foliage']);
 stream.plan({x:340,y:0,z:-70},'quality');
 while(stream.pending)stream.step();
 assert.deepEqual(calls.slice(2),['Farol/grass','Farol/flowers']);
});

test('texture prefetch is limited to one low-resolution map and no 2K predownloads',()=>{
 const root=new URL('../src/world/TerrainTextureManager.js',import.meta.url);
 const source=readFileSync(root,'utf8');
 assert.match(source,/prefetchAhead\(island=null\)/);
 assert.match(source,/this\._queueJob\(next\.kind,'diff','low',520\)/);
 assert.match(source,/if\(this\.ahead\)needed\.add\(textureFile\(this\.ahead\.kind,'diff','low'\)\)/);
 assert.match(source,/this\.loading\.get\(textureFile\(this\.ahead\.kind,'diff','low'\)\)/);
 assert.match(source,/if\(this\.busy\)return/);
});

test('real gameplay sends obstacle grid and movement heading, leaving physics and saves unchanged',()=>{
 const base=new URL('../src/',import.meta.url);
 const source=path=>readFileSync(new URL(path,base),'utf8');
 const game=source('game/Game.js'),world=source('world/World.js');
 assert.match(game,/this\.world\.updateDetail\(this\.camera\.position,dt,\{/);
 assert.match(game,/direction:\{x:-Math\.sin\(this\.dragon\.yaw\),z:-Math\.cos\(this\.dragon\.yaw\)\}/);
 assert.match(game,/COLISÕES ESPACIAIS/);
 assert.match(world,/this\.obstacleGrid=new ObstacleGrid/);
 assert.match(world,/this\.terrainTextures\.prefetchAhead\(predicted\)/);
 assert.match(source('entities/Dragon.js'),/this\.world\.obstacleGrid/);
 assert.match(source('entities/Hero.js'),/this\.world\.obstacleGrid/);
});
