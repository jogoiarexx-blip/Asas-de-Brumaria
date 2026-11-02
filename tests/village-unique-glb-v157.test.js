import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VILLAGE_MODEL_CATALOG,assertUniqueVillageModels,villageModelUrl}
  from '../src/entities/villageModelCatalog.js';
import {inspectGLB} from '../src/entities/glbValidation.js';
import {CONTRACTS,VillageContracts} from '../src/systems/VillageContracts.js';

test('três NPCs têm GLBs exclusivos, com nomes de arquivos enviados pelo usuário',()=>{
  assert.equal(assertUniqueVillageModels(),true);
  assert.deepEqual(Object.keys(VILLAGE_MODEL_CATALOG).sort(),['borin','iara','tavi']);
  assert.deepEqual(Object.values(VILLAGE_MODEL_CATALOG).map(x=>x.file).sort(),
    ['Astrid.glb','cabeça de vento (2).glb','forja.glb'].sort());
  assert.throws(()=>assertUniqueVillageModels({
    iara:{file:'Astrid.glb'},tavi:{file:'Astrid.glb'}
  }),/exclusivo/);
  assert.ok(villageModelUrl(VILLAGE_MODEL_CATALOG.tavi).href.includes('cabe%C3%A7a%20de%20vento%20(2).glb'));
});
test('os três arquivos binários são GLB 2.0 válidos, com malha real',()=>{
  for(const spec of Object.values(VILLAGE_MODEL_CATALOG)){
    const bytes=readFileSync(new URL('../npc/'+spec.file,import.meta.url));
    const info=inspectGLB(bytes);
    assert.equal(info.version,2);
    assert.ok(info.meshCount>0,spec.file+' precisa conter mesh');
    assert.ok(info.byteLength>1_000_000,spec.file+' não pode ser placeholder');
    assert.ok(spec.targetHeight>=3.2&&spec.targetHeight<=3.5,'altura humana NPC');
    assert.ok(Number.isFinite(spec.yaw),'rotação deve ser finita');
  }
});
test('contratos, colisão, animações e diálogos preservam IDs anteriores',()=>{
  assert.equal(CONTRACTS.correio.npc,'iara');
  assert.equal(CONTRACTS.minérios.npc,'borin');
  assert.equal(CONTRACTS.patrulha.npc,'tavi');
  assert.ok(CONTRACTS.correio.description.includes('Astrid'));
  assert.ok(CONTRACTS.patrulha.description.includes('Cabeça de Vento'));
  const contracts=new VillageContracts();
  for(const id of ['iara','borin','tavi'])assert.equal(contracts.talk(id).action,'accepted');
  const npc=readFileSync(new URL('../src/entities/VillageNPCs.js',import.meta.url),'utf8');
  assert.match(npc,/body\.visible=false/);
  assert.match(npc,/body\.visible=true/);
  assert.match(npc,/world\.addObstacle\(spec\.x,root\.position\.y,spec\.z,\.63,3\.5,'npc'\)/);
  assert.match(npc,/streamModels\(observer,canLoad/);
  assert.match(npc,/this\.modelLoading=loadVillageModel\(config\)/);
  assert.match(npc,/root\.add\(labelSprite\(spec\.name,spec\.role\)\)/);
  const game=readFileSync(new URL('../src/game/Game.js',import.meta.url),'utf8');
  assert.match(game,/this\.villagers\.setDetail\(observer,tier,camera,forward,this\.started&&!this\.preparing\)/);
});
test('normalização usa escala uniforme e apoia os pés na origem do NPC',()=>{
  const src=readFileSync(new URL('../src/entities/VillageGLBAssets.js',import.meta.url),'utf8');
  assert.match(src,/new THREE\.Box3\(\)\.setFromObject\(scene\)/);
  assert.match(src,/scene\.scale\.setScalar\(scale\)/);
  assert.match(src,/scene\.position\.set\(-center\.x\*scale,-bounds\.min\.y\*scale,-center\.z\*scale\)/);
  assert.match(src,/gltf\.animations/);
  assert.match(src,/new THREE\.AnimationMixer/);
  assert.match(src,/await getLoader\(\)/);
});
