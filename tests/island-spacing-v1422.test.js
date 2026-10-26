import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ISLAND_SPACING,ORIGINAL_ISLAND_CENTERS,migrateLegacyMapPoint,stretchPointOnIsland} from '../src/world/IslandLayout.js';
import {ISLANDS,RING_POSITIONS,CRYSTAL_POSITIONS,HATCHLING_POSITIONS,TARGET_POSITIONS} from '../src/world/config.js';
import {WILD_DRAGON_DEFS} from '../src/systems/WildBonds.js';
import {FRONTIER_ZONES,nearestFrontierObjective} from '../src/systems/FrontierRules.js';
import {CONTRACTS} from '../src/systems/VillageContracts.js';
import {CIRCUITS} from '../src/systems/TrainingConfig.js';
import {normalizeSave} from '../src/systems/SaveSystem.js';

const near=(point,island)=>Math.hypot(point[0]-island.x,point[2]-island.z);
test('original island sizes stay unchanged while centres are 50% farther apart',()=>{
 assert.equal(ISLAND_SPACING,1.5);assert.equal(ISLANDS.length,7);
 assert.deepEqual(ISLANDS[0],{name:'Ilha do Refúgio',x:0,z:0,r:83,h:22,seed:0.5});
 for(const island of ISLANDS){const old=ORIGINAL_ISLAND_CENTERS[island.name];
  assert.equal(island.x,old.x*1.5);assert.equal(island.z,old.z*1.5);
  assert.equal(island.r,old.r);
 }
 for(let i=0;i<ISLANDS.length;i++)for(let j=i+1;j<ISLANDS.length;j++){
  const a=ISLANDS[i],b=ISLANDS[j];
  const oldA=ORIGINAL_ISLAND_CENTERS[a.name],oldB=ORIGINAL_ISLAND_CENTERS[b.name];
  assert.ok(Math.abs(Math.hypot(a.x-b.x,a.z-b.z)/Math.hypot(oldA.x-oldB.x,oldA.z-oldB.z)-1.5)<1e-10);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)-a.r-b.r>25);
 }
});
test('quest objects follow their islands and remain at the same local positions',()=>{
 const cascatas=ISLANDS[1],farol=ISLANDS[2],nevoa=ISLANDS[3];
 assert.ok(near(CRYSTAL_POSITIONS[0],cascatas)<60);
 assert.ok(near(CRYSTAL_POSITIONS[1],farol)<60);
 assert.ok(near(HATCHLING_POSITIONS[0],cascatas)<60);
 assert.ok(near(HATCHLING_POSITIONS[1],farol)<60);
 assert.ok(near(HATCHLING_POSITIONS[2],nevoa)<65);
 assert.equal(RING_POSITIONS.length,5);assert.equal(TARGET_POSITIONS.length,3);
 for(const [spec,island] of WILD_DRAGON_DEFS.map(x=>[x,ISLANDS.find(i=>i.name===x.island)]))
  assert.ok(Math.hypot(spec.x-island.x,spec.z-island.z)<55);
 assert.match(readFileSync(new URL('../src/entities/EnemyDragon.js',import.meta.url),'utf8'),/stretchPointOnIsland\(\[enemy\.x,enemy\.y,enemy\.z\],island\)/);
 for(const zone of FRONTIER_ZONES){const island=ISLANDS.find(i=>i.name===zone.name);
  assert.deepEqual([zone.x,zone.z],[island.x,island.z]);
  for(const [x,z] of zone.markers)assert.ok(Math.hypot(x-zone.x,z-zone.z)<island.r);
  assert.ok(nearestFrontierObjective({x:zone.x,z:zone.z}));
 }
 assert.ok(CONTRACTS.socorro.points.every(p=>ISLANDS.slice(1).some(i=>near(p,i)<90)));
 assert.equal(CIRCUITS.frontier.checkpoints.length,7);assert.ok(CIRCUITS.frontier.seconds>=195);
});
test('old saves are moved once and saves from current map do not move again',()=>{
 const payload={version:1,mission:{stage:2,progress:0},progression:{},player:{x:-181,z:-120,heroX:4,heroZ:12,mounted:true,airborne:true}};
 const upgraded=normalizeSave(payload);
 assert.equal(upgraded.layoutVersion,2);
 assert.equal(upgraded.player.x,-181-183*.5);
 assert.equal(upgraded.player.z,-120-126*.5);
 assert.equal(upgraded.player.heroX,4);assert.equal(upgraded.player.heroZ,12);
 const current=normalizeSave({...payload,layoutVersion:2,player:upgraded.player});
 assert.deepEqual(current.player,upgraded.player);
 assert.deepEqual(migrateLegacyMapPoint(310,35),{x:310,z:35});
 assert.deepEqual(migrateLegacyMapPoint(700,0),{x:700,z:0});
 assert.deepEqual(stretchPointOnIsland([-320,38,95],'Arquipélago dos Cristais'),[-480,38,142.5]);
});
