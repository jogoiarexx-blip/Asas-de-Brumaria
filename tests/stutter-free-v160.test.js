import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GraphicsQuality} from '../src/systems/GraphicsQuality.js';
import {prewarmObject,collectTextures} from '../src/systems/GpuPrewarm.js';

const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const fakeRenderer=()=>({ratio:0,shadowMap:{enabled:true,autoUpdate:true,needsUpdate:false},setPixelRatio(v){this.ratio=v;}});
const memoryStore=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};

test('v1.6.0: ajuste automático com iluminação travada não liga/desliga shadowMap.enabled',()=>{
  const renderer=fakeRenderer();
  const quality=new GraphicsQuality(renderer,1,false,8,memoryStore());
  assert.equal(quality.tier,'quality');assert.equal(renderer.shadowMap.enabled,true);
  quality.lockLighting(true);
  quality.tier='economy';quality.apply();
  // Programas compilados com sombra continuam válidos: só o passe é pausado.
  assert.equal(renderer.shadowMap.enabled,true);
  assert.equal(renderer.shadowMap.autoUpdate,false);
  assert.equal(quality.shadowsActive,false);
  quality.tier='balanced';quality.apply();
  assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(quality.shadowsActive,true);
});

test('v1.6.0: iniciado sem sombras, o modo automático não as compila em pleno voo',()=>{
  const renderer=fakeRenderer();
  const quality=new GraphicsQuality(renderer,1,false,2,memoryStore());
  assert.equal(quality.tier,'economy');assert.equal(renderer.shadowMap.enabled,false);
  quality.lockLighting(true);
  quality.tier='quality';quality.apply();
  assert.equal(renderer.shadowMap.enabled,false);assert.equal(quality.shadowsActive,false);
});

test('v1.6.0: troca manual (G) continua aplicando a qualidade completa',()=>{
  const renderer=fakeRenderer();
  const quality=new GraphicsQuality(renderer,1,false,8,memoryStore());
  quality.lockLighting(true);
  for(let i=0;i<5&&quality.tier!=='economy';i++)quality.cycle();
  assert.equal(quality.tier,'economy');
  assert.equal(renderer.shadowMap.enabled,false);
  assert.equal(renderer.shadowMap.autoUpdate,true);
});

test('v1.6.0: pré-aquecimento envia uma textura por quadro e compila antes de exibir',async()=>{
  const texA={isTexture:true,image:{}},texB={isTexture:true,image:{}};
  const mesh={material:{map:texA,normalMap:texB,roughnessMap:texA}};
  const root={traverse(visit){visit({});visit(mesh);}};
  assert.equal(collectTextures(root).length,2);
  const order=[];
  const renderer={initTexture:t=>order.push(t===texA?'A':'B'),compileAsync:async(obj,camera,scene)=>{order.push('compile');assert.equal(obj,root);assert.ok(camera&&scene);}};
  const report=await prewarmObject(renderer,root,{camera:{},scene:{},yieldFrame:async()=>order.push('frame')});
  assert.deepEqual(order,['A','frame','B','frame','compile']);
  assert.equal(report.textures,2);assert.equal(report.compiled,true);assert.equal(report.failures.length,0);
});

test('v1.6.0: falha de GPU no pré-aquecimento nunca interrompe o jogo',async()=>{
  const root={traverse(visit){visit({material:{map:{isTexture:true,image:{}}}});}};
  const renderer={initTexture(){throw new Error('contexto perdido');},compileAsync:async()=>{throw new Error('sem shader');}};
  const report=await prewarmObject(renderer,root,{camera:{},scene:{},yieldFrame:async()=>{}});
  assert.equal(report.compiled,false);assert.equal(report.failures.length,2);
});

test('v1.6.0: integração — luzes mudam por intensidade, texturas por ImageBitmap, objetos tardios pré-aquecidos',()=>{
  const game=src('../src/game/Game.js'),manager=src('../src/world/TerrainTextureManager.js');
  const npcs=src('../src/entities/VillageNPCs.js'),ui=src('../src/ui/UI.js'),weather=src('../src/systems/Weather.js');
  assert.match(game,/this\.graphics\.lockLighting\(true\)/);
  assert.match(game,/if\(structural\)fire\.visible=tier!=='economy'/);
  assert.match(game,/sun\.shadow\.intensity=this\.graphics\.shadowsActive\?1:0/);
  assert.match(game,/chunk\.root\.visible=false;[\s\S]{0,260}prewarmObject\(this\.renderer,chunk\.root/);
  assert.match(manager,/THREE\.ImageBitmapLoader/);
  assert.match(manager,/imageOrientation:'flipY'/);
  assert.match(manager,/TERRAIN_UPLOAD_GAP_MS/);
  assert.match(manager,/_normalFor\(/);
  assert.match(npcs,/await this\.prewarm\?\.\(model\.holder\)/);
  assert.match(ui,/this\.stableDirty=true;return;/);
  assert.doesNotMatch(weather,/lerp\(new THREE\.Color/);
});

test('v1.6.0: céu em degradê é um único draw call sem profundidade nem tone mapping',()=>{
  const sky=src('../src/world/SkyDome.js'),game=src('../src/game/Game.js');
  assert.match(sky,/depthTest:false,depthWrite:false,fog:false,toneMapped:false/);
  assert.match(sky,/renderOrder=-1000/);
  assert.doesNotMatch(sky,/TextureLoader|castShadow=true/);
  assert.match(game,/this\.skyDome\.update\(this\.camera/);
});
