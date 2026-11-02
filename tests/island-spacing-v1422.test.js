import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 ISLAND_SPACING,ISLAND_SIZE_SCALE,PREVIOUS_ISLAND_SPACING,
 ORIGINAL_ISLAND_CENTERS,islandOffset,coastGap,migrateLegacyMapPoint,stretchPointOnIsland
} from '../src/world/IslandLayout.js';
import {ISLANDS,RING_POSITIONS,CRYSTAL_POSITIONS,HATCHLING_POSITIONS,TARGET_POSITIONS} from '../src/world/config.js';
import {WILD_DRAGON_DEFS} from '../src/systems/WildBonds.js';
import {FRONTIER_ZONES,nearestFrontierObjective} from '../src/systems/FrontierRules.js';
import {CONTRACTS} from '../src/systems/VillageContracts.js';
import {CIRCUITS} from '../src/systems/TrainingConfig.js';
import {normalizeSave} from '../src/systems/SaveSystem.js';

const near=(point,island)=>Math.hypot(point[0]-island.x,point[2]-island.z);
test('layout v3 aumenta tanto as ilhas quanto todas as distâncias costeiras',()=>{
 assert.equal(ISLAND_SPACING,1.75);
 assert.equal(PREVIOUS_ISLAND_SPACING,1.5);
 assert.equal(ISLAND_SIZE_SCALE,1.18);
 assert.equal(ISLANDS.length,7);
 assert.equal(ISLANDS[0].x,0);
 assert.equal(ISLANDS[0].r,83*1.18);
 for(const island of ISLANDS){
  const old=ORIGINAL_ISLAND_CENTERS[island.name];
  assert.equal(island.x,old.x*ISLAND_SPACING+islandOffset(island.name).x);
  assert.equal(island.z,old.z*ISLAND_SPACING+islandOffset(island.name).z);
  assert.equal(island.r,old.r*ISLAND_SIZE_SCALE);
 }
 for(let i=0;i<ISLANDS.length;i++)for(let j=i+1;j<ISLANDS.length;j++){
  const a=ISLANDS[i],b=ISLANDS[j];
  const oldA=ORIGINAL_ISLAND_CENTERS[a.name],oldB=ORIGINAL_ISLAND_CENTERS[b.name];
  const originalCenterDist=Math.hypot(oldA.x-oldB.x,oldA.z-oldB.z);
  const coastalGap=Math.hypot(a.x-b.x,a.z-b.z)-a.r-b.r;
  const oldGap=originalCenterDist*PREVIOUS_ISLAND_SPACING-oldA.r-oldB.r;
  assert.ok(Math.abs(coastalGap-coastGap(a,b))<1e-8);
  assert.ok(coastalGap>230,`${a.name} / ${b.name}: costas muito próximas`);
 }
 const eastern=ISLANDS.find(i=>i.name==='Ilha das Cinzas');
 const western=ISLANDS.find(i=>i.name==='Arquipélago dos Cristais');
 assert.ok(eastern.x+eastern.r<650,'Ilha das Cinzas não pode alcançar o mapa da montanha');
 assert.ok(western.x-western.r>-640,'Ilha dos Cristais dentro do limite do mundo');
});
test('todos os objetivos e inimigos acompanham os centros sem sair de terra',()=>{
 const cascatas=ISLANDS[1],farol=ISLANDS[2],nevoa=ISLANDS[3];
 assert.ok(near(CRYSTAL_POSITIONS[0],cascatas)<cascatas.r);
 assert.ok(near(CRYSTAL_POSITIONS[1],farol)<farol.r);
 assert.ok(near(HATCHLING_POSITIONS[0],cascatas)<cascatas.r);
 assert.ok(near(HATCHLING_POSITIONS[1],farol)<farol.r);
 assert.ok(near(HATCHLING_POSITIONS[2],nevoa)<nevoa.r);
 assert.equal(RING_POSITIONS.length,5);
 assert.equal(TARGET_POSITIONS.length,3);
 for(const spec of WILD_DRAGON_DEFS){
  const island=ISLANDS.find(i=>i.name===spec.island);
  assert.ok(Math.hypot(spec.x-island.x,spec.z-island.z)<island.r);
 }
 assert.match(readFileSync(new URL('../src/entities/EnemyDragon.js',import.meta.url),'utf8'),/stretchPointOnIsland\(\[enemy\.x,enemy\.y,enemy\.z\],island\)/);
 for(const zone of FRONTIER_ZONES){
  const island=ISLANDS.find(i=>i.name===zone.name);
  assert.equal(zone.x,island.x);
  assert.equal(zone.z,island.z);
  for(const [x,z] of zone.markers)assert.ok(Math.hypot(x-zone.x,z-zone.z)<island.r);
  assert.ok(nearestFrontierObjective({x:zone.x,z:zone.z}));
 }
 assert.ok(CONTRACTS.socorro.points.every(p=>ISLANDS.slice(1).some(i=>near(p,i)<90)));
 assert.equal(CIRCUITS.frontier.checkpoints.length,7);
 assert.ok(CIRCUITS.frontier.seconds>=270);
});
test('saves v1 e v2 migram uma vez para layout v3 sem tocar no portal da montanha',()=>{
 const mission={stage:2,progress:0};
 const origin={version:1,mission,progression:{},
  player:{x:-181,z:-120,heroX:4,heroZ:12,mounted:true,airborne:true}};
 const old=normalizeSave(origin);
 assert.equal(old.layoutVersion,3);
 assert.equal(old.player.x,-181-183*.75+islandOffset('Ilha das Cascatas').x);
 assert.equal(old.player.z,-120-126*.75+islandOffset('Ilha das Cascatas').z);
 assert.equal(old.player.heroX,4);
 const v2=normalizeSave({...origin,layoutVersion:2,
  player:{x:-181-183*.5,z:-120-126*.5,heroX:4,heroZ:12,mounted:true,airborne:true}});
 assert.equal(v2.layoutVersion,3);
 assert.equal(v2.player.x,old.player.x);
 assert.equal(v2.player.z,old.player.z);
 const newest=normalizeSave({...origin,layoutVersion:3,islandLayoutVersion:2,player:old.player});
 assert.deepEqual(newest.player,old.player);
 assert.deepEqual(migrateLegacyMapPoint(310,35),{x:310,z:35});
 assert.deepEqual(migrateLegacyMapPoint(310,35,1.5),{x:310,z:35});
 assert.deepEqual(migrateLegacyMapPoint(700,0,1.5),{x:700,z:0});
 assert.deepEqual(stretchPointOnIsland([-320,38,95],'Arquipélago dos Cristais'),[-560,38,296.25]);
});
