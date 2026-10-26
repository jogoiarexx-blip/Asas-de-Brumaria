import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildWarmupPlan,partitionWarmup} from '../src/systems/GraphicsWarmupPlan.js';
const source=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const mesh=(material,flags={})=>({isMesh:true,geometry:{attributes:{}},material,children:[],...flags});

test('warmup traverses invisible enemies and deduplicates identical shader variants',()=>{
  const diffuse={isTexture:true,image:{width:32}},material={map:diffuse};
  const visible=mesh(material),hidden=mesh(material,{visible:false});
  const root={children:[visible,hidden]};
  const {variants,textures}=buildWarmupPlan([{name:'actors',roots:[root]}]);
  assert.equal(variants.length,1);
  assert.equal(textures.length,1);
  assert.equal(textures[0],diffuse);
});

test('warmup prepares instanced foliage and skinned actors as separate shader variants',()=>{
  const material={map:{isTexture:true,source:{data:new Uint8Array(4)}}};
  const roots=[mesh(material),mesh(material,{isInstancedMesh:true,visible:false}),mesh(material,{isSkinnedMesh:true,visible:false})];
  const {variants,textures}=buildWarmupPlan([{name:'world',roots}]);
  assert.equal(variants.length,3);
  assert.equal(textures.length,1);
  assert.deepEqual(partitionWarmup(variants,2).map(a=>a.length),[2,1]);
  assert.throws(()=>partitionWarmup(variants,0));
});

test('startup stays frozen during GPU preparation and only then enables the game',()=>{
  const game=source('../src/game/Game.js');
  const start=game.slice(game.indexOf('  start(){'),game.indexOf('  newGame(){'));
  const frame=game.slice(game.indexOf('  frame(){'));
  assert.match(start,/this\.preparing=true/);
  assert.match(start,/await prep\.run\(this\)/);
  assert.ok(start.indexOf('await prep.run(this)')<start.indexOf('this.started=true'));
  assert.match(frame,/if\(!this\.started\)\{[\s\S]*?return;/);
  assert.match(start,/this\.world\.terrainTextures\.updateFocus\(focus,ISLANDS\)/);
  assert.doesNotMatch(start,/this\.graphics\.tier\s*=/);
});

test('graphics progress elements and GPU warmup scene are wired',()=>{
  const html=source('../index.html'),runtime=source('../src/systems/GraphicsWarmup.js');
  for(const id of ['graphics-preparation','graphics-preparation-percent','graphics-preparation-bar','graphics-preparation-label'])
    assert.ok(html.includes(`id="${id}"`));
  assert.match(runtime,/renderer\.initTexture\(texture\)/);
  assert.match(runtime,/renderer\.compileAsync\(staging,this\.camera,this\.scene\)/);
  assert.match(runtime,/this\.renderer\.render\(this\.scene,this\.camera\)/);
  assert.match(runtime,/staging\.clear\(\)/);
});
