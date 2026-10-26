import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TERRAIN_LOD,coastDistance,islandTextureLevel,prioritizeIslandLevels}
  from '../src/world/TerrainTextureLOD.js';
const source=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const island={name:'Ilha',x:100,z:-40,r:50};
const at=edge=>({x:island.x+island.r+edge,z:island.z});

test('quality tiers use distance from coast, full 2K near, 1K mid and 512 far',()=>{
 assert.equal(coastDistance({x:100,z:-40},island),0);
 assert.equal(islandTextureLevel(at(0),island,'quality'),'desktop');
 assert.equal(islandTextureLevel(at(240),island,'quality'),'mobile');
 assert.equal(islandTextureLevel(at(510),island,'quality'),'low');
 assert.equal(islandTextureLevel(at(850),island,'quality'),null);
 assert.equal(islandTextureLevel(at(0),island,'balanced'),'mobile');
 assert.equal(islandTextureLevel(at(0),island,'economy'),'mobile');
});

test('hysteresis suppresses LOD switching around high and medium boundaries',()=>{
 assert.equal(islandTextureLevel(at(165),island,'quality','desktop'),'desktop');
 assert.equal(islandTextureLevel(at(165),island,'quality','mobile'),'mobile');
 assert.equal(islandTextureLevel(at(330),island,'quality','mobile'),'mobile');
 assert.equal(islandTextureLevel(at(330),island,'quality','low'),'low');
 assert.equal(islandTextureLevel(at(700),island,'quality','low'),'low');
 assert.equal(islandTextureLevel(at(700),island,'quality',null),null);
 assert.ok(TERRAIN_LOD.highLeave>TERRAIN_LOD.highEnter);
 assert.ok(TERRAIN_LOD.lowLeave>TERRAIN_LOD.lowEnter);
});

test('two islands of the same biome can have independent texture quality',()=>{
 const islands=[island,{name:'Near neighbour',x:700,z:-40,r:50}];
 const tiers=prioritizeIslandLevels(at(10),islands,'quality');
 assert.equal(tiers[0].level,'desktop');
 assert.equal(tiers[1].level,'low');
 assert.match(source('../src/world/World.js'),
   /terrainTextures\.register\(terrainKind\(island\),material,island\)/);
});

test('five 512px CC0 WebP previews are hashed, small, and present on disk',()=>{
 const manifest=JSON.parse(source('../assets/textures/terrain/manifest.json'));
 const variants=manifest.distance_lod.variants;
 assert.equal(Object.keys(variants).length,5);
 let bytes=0;
 for(const [kind,record] of Object.entries(variants)){
  const path=new URL(`../assets/textures/terrain/${record.filename}`,import.meta.url);
  assert.equal(existsSync(path),true,kind);
  const buffer=readFileSync(path);bytes+=buffer.length;
  assert.deepEqual(record.size,[512,512]);
  assert.equal(record.bytes,buffer.length);
  assert.equal(buffer.toString('ascii',0,4),'RIFF');
  assert.equal(buffer.toString('ascii',8,12),'WEBP');
  assert.equal(record.sha256,createHash('sha256').update(buffer).digest('hex'));
 }
 assert.ok(bytes<450_000,'distant previews should have low transfer cost');
});

test('manager uses sequential idle GPU uploads, retains old photos and evicts unused maps',()=>{
 const manager=source('../src/world/TerrainTextureManager.js');
 assert.match(manager,/if\(this\.busy\)return;/);
 assert.match(manager,/await this\.loader\.loadAsync\(job\.url\)/);
 assert.match(manager,/this\.scheduleIdle\(warm\)/);
 assert.match(manager,/this\.renderer\?\.initTexture\?\.\(texture\)/);
 assert.match(manager,/this\.loading\.delete\(url\);texture\.dispose\(\)/);
 assert.match(manager,/const map=desired\?\?\(material\.map===this\.placeholder\?preview:null\)/);
 assert.match(manager,/this\.neutralNormal/);
});
