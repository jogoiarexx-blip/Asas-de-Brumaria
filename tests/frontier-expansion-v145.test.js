import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ISLANDS} from '../src/world/config.js';
import {LANDMARKS,Discovery} from '../src/systems/Discovery.js';
import {terrainPalette} from '../src/world/TerrainPalette.js';
import {CIRCUITS} from '../src/systems/TrainingConfig.js';
import {visibleIslandFoliage,detailRadius} from '../src/world/VisibilityBudget.js';
import {GraphicsQuality} from '../src/systems/GraphicsQuality.js';
const source=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('seven explorable islands include two separate accessible biome regions',()=>{
 assert.equal(ISLANDS.length,7);
 const crystal=ISLANDS.find(i=>i.name==='Arquipélago dos Cristais');
 const ash=ISLANDS.find(i=>i.name==='Ilha das Cinzas');
 assert.equal(crystal?.biome,'crystal');
 assert.equal(ash?.biome,'ash');
 for(const [i,a] of ISLANDS.entries()){
  assert.ok(a.r>=40&&a.h>=15);
  for(const b of ISLANDS.slice(i+1)){
   assert.ok(Math.hypot(a.x-b.x,a.z-b.z) > a.r+b.r+12,
    'Overlapping islands: '+a.name+', '+b.name);
  }
 }
 const world=source('../src/world/World.js');
 assert.match(world,/for \(const island of ISLANDS\) this\.buildIsland\(island\)/);
 assert.match(world,/terrainPalette\(y,slope,detail,island\.biome\)/);
});
test('two new exploration monuments do not reset old saves',()=>{
 assert.deepEqual(LANDMARKS.slice(0,5).map(x=>x.id),
  ['refugio','cascatas','farol','nevoa','atol']);
 assert.deepEqual(LANDMARKS.slice(5).map(x=>x.id),['cristais','cinzas']);
 const older=new Discovery({found:['refugio','farol']});
 assert.equal(older.total,2);
 assert.equal(older.found.length,7);
 assert.equal(older.discover(5)?.id,'cristais');
 assert.equal(older.discover(6)?.id,'cinzas');
 assert.deepEqual(older.snapshot().found,['refugio','farol','cristais','cinzas']);
});
test('new island biomes are distinct using existing vertex colors only',()=>{
 const base=terrainPalette(8,.2,.1);
 const crystal=terrainPalette(8,.2,.1,'crystal');
 const ash=terrainPalette(8,.2,.1,'ash');
 assert.notDeepEqual(base,crystal);
 assert.notDeepEqual(base,ash);
 assert.notDeepEqual(crystal,ash);
 assert.ok([...base,...crystal,...ash].every(x=>x>=0&&x<=1));
 const world=source('../src/world/World.js');
 assert.ok(world.includes('new THREE.InstancedMesh('));
});
test('new seven-marker stage has clear unlock gate and reachable checkpoints',()=>{
 const c=CIRCUITS.frontier;
 assert.equal(c.checkpoints.length,7);
 assert.equal(c.seconds,165);
 assert.ok(c.reward>=3&&c.minSpeed>0);
 assert.ok(c.checkpoints.some(p=>Math.hypot(p[0]+320,p[2]-95)<20));
 assert.ok(c.checkpoints.some(p=>Math.hypot(p[0]-332,p[2]+110)<20));
 const html=source('../index.html'),game=source('../src/game/Game.js'),ui=source('../src/ui/UI.js');
 assert.match(html,/id="train-frontier"/);
 assert.match(game,/mode==='frontier'&&this\.progression\.circuits<2/);
 assert.match(ui,/game\.startTraining\('frontier'\)/);
});
test('far island detail is culled without hiding terrain on quality profile',()=>{
 const far=ISLANDS.at(-1);
 assert.equal(visibleIslandFoliage({x:-520,z:500,y:5},far,'quality'),false);
 assert.equal(visibleIslandFoliage({x:far.x+25,z:far.z,y:5},far,'quality'),true);
 assert.ok(detailRadius('quality',5)>=500);
 const src=source('../src/world/World.js');
 assert.match(src,/this\.world|this\.scene|this\.obstacles/);
});
test('adaptive sub-tier resolution reduces only pixel fill; full graphics tier and shadows stay intact',()=>{
 const renderer={ratio:0,setPixelRatio(r){this.ratio=r;},shadowMap:{enabled:false,needsUpdate:false}};
 const gfx=new GraphicsQuality(renderer,2,false,8,{getItem:()=>null,setItem:()=>{}});
 const tier=gfx.tier;
 assert.equal(tier,'quality');
 const before=renderer.ratio;
 for(let i=0;i<3;i++)gfx.sample(39);
 assert.equal(gfx.tier,tier);
 assert.equal(gfx.autoPixelScale,.96);
 assert.ok(renderer.ratio<before);
 assert.equal(renderer.shadowMap.enabled,true);
 for(let i=0;i<5;i++)gfx.sample(55);
 assert.equal(gfx.autoPixelScale,1);
 assert.equal(gfx.tier,tier);
});
