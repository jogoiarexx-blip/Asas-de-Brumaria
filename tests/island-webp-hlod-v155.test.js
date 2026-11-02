import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ISLANDS} from '../src/world/config.js';
import {IMPOSTOR_PROFILES,lodFromShore,boxSize} from '../src/world/ImpostorRules.js';
import {ISLAND_LAYOUT_OFFSETS,ISLAND_SPACING,ISLAND_SIZE_SCALE,
  ORIGINAL_ISLAND_CENTERS,coastGap,migrateSeparatedIslandPoint} from '../src/world/IslandLayout.js';
import {normalizeSave} from '../src/systems/SaveSystem.js';
import {MOUNTAIN_PORTAL} from '../src/systems/ExpeditionRules.js';
import {CIRCUITS} from '../src/systems/TrainingConfig.js';

test('nova separação preserva sete ilhas e mínimo de 230 metros entre costas',()=>{
 assert.equal(ISLANDS.length,7);
 const gaps=[];
 for(let i=0;i<ISLANDS.length;i++)for(let j=i+1;j<ISLANDS.length;j++)gaps.push(coastGap(ISLANDS[i],ISLANDS[j]));
 assert.ok(Math.min(...gaps)>230,Math.min(...gaps));
 const ash=ISLANDS.find(i=>i.name==='Ilha das Cinzas');
 assert.equal(ash.x,332*1.75);assert.equal(ash.z,-110*1.75);
 assert.ok(ash.x+ash.r<650);
 assert.ok(Math.hypot(MOUNTAIN_PORTAL.x-ash.x,MOUNTAIN_PORTAL.z-ash.z)<ash.r);
 const fog=ISLANDS.find(i=>i.name==='Ilha da Névoa');
 const old=ORIGINAL_ISLAND_CENTERS[fog.name];
 assert.equal(fog.x,old.x*ISLAND_SPACING+ISLAND_LAYOUT_OFFSETS[fog.name].x);
 assert.equal(fog.z,old.z*ISLAND_SPACING+ISLAND_LAYOUT_OFFSETS[fog.name].z);
 assert.ok(CIRCUITS.frontier.seconds>=315);
});
test('saves antigos migram uma vez; posições de mar, portal e montanha não se movem',()=>{
 const initial={version:1,layoutVersion:3,portalVersion:2,
  mission:{stage:5,progress:2},progression:{points:19},
  player:{x:-320.25,z:-220.5,heroX:-320.25,heroZ:-220.5,mounted:true,airborne:false}};
 const next=normalizeSave(initial);
 assert.equal(next.islandLayoutVersion,2);
 assert.equal(next.player.x,-410);
 assert.equal(next.player.z,-270);
 assert.equal(next.mission.stage,5);
 assert.equal(next.progression.points,19);
 assert.deepEqual(normalizeSave(next).player,next.player);
 assert.deepEqual(migrateSeparatedIslandPoint(800,0),{x:800,z:0});
 assert.deepEqual(migrateSeparatedIslandPoint(633,-192.5),{x:633,z:-192.5});
 assert.deepEqual(migrateSeparatedIslandPoint(332,35),{x:332,z:35});
});
test('HLOD alterna WebP/low-poly/full com histerese, sem oscilar na borda',()=>{
 const p=IMPOSTOR_PROFILES.balanced;
 assert.equal(lodFromShore(20,p,'far'),'full');
 assert.equal(lodFromShore(158,p,'full'),'mid');
 assert.equal(lodFromShore(213,p,'mid'),'mid');
 assert.equal(lodFromShore(241,p,'mid'),'far');
 assert.equal(lodFromShore(208,p,'far'),'far');
 assert.equal(lodFromShore(170,p,'far'),'mid');
 assert.equal(lodFromShore(1060,p,'far'),'hidden');
 assert.equal(IMPOSTOR_PROFILES.economy.far<IMPOSTOR_PROFILES.quality.far,true);
});
test('proporções reais usam Box3 da fonte e pivot do modelo, sem depender de pixels',()=>{
 const b=boxSize({min:{x:-2,y:1,z:-3},max:{x:4,y:9,z:2}});
 assert.deepEqual(b,{width:6,height:8,centerY:5});
 const src=readFileSync(new URL('../src/world/ImpostorWebP.js',import.meta.url),'utf8');
 assert.match(src,/geometry\.boundingBox/);
 assert.match(src,/applyMatrix4\(dummy\.matrix\)/);
 assert.match(src,/setFromObject\(object\)/);
 assert.match(src,/dummy\.scale\.set\(size\.width,size\.height,1\)/);
 assert.match(src,/registerObject\(object/);
 assert.match(src,/alphaTest/);
 assert.match(src,/this\.loader\.load\(url/);
 const world=readFileSync(new URL('../src/world/World.js',import.meta.url),'utf8');
 assert.match(world,/this\.impostors\.update\(/);
 assert.match(world,/this\.impostors\.registerObject\(house/);
 assert.match(world,/this\.detailStream\.step\(1\)/);
});
