import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VILLAGE_AI_PROFILES,makeVillageBrain,selectVillageGoal,
  advanceVillageBrain,distanceXZ} from '../src/entities/VillageNPCAI.js';

const people=[
  ['iara',-17,25],['lume',22,14],['borin',-7,-24],
  ['nara',34,24],['tavi',-29,31],['suri',-30,-15]
];
test('seis inteligências independentes, com velocidades e rotas próprias',()=>{
  assert.equal(Object.keys(VILLAGE_AI_PROFILES).length,6);
  const seeds=new Set();
  for(const [id,x,z] of people){
    const brain=makeVillageBrain({id,x,z},people.findIndex(p=>p[0]===id));
    assert.ok(brain.profile.radius>=13 && brain.profile.radius<=30);
    assert.ok(brain.profile.speed>0);
    assert.ok(!seeds.has(brain.seed),'semente duplicada');seeds.add(brain.seed);
    const goal=selectVillageGoal(brain,{x,z},()=>true);
    assert.ok(distanceXZ(goal,{x,z})>3.4);
    assert.ok(distanceXZ(goal,{x,z})<=brain.profile.radius+1e-6);
  }
});
test('IA determinística desacelera para repousar e retorna periodicamente ao posto',()=>{
 const a=makeVillageBrain({id:'iara',x:-17,z:25},0);
 const b=makeVillageBrain({id:'iara',x:-17,z:25},0);
 let p={x:-17,z:25},q={...p};
 for(let i=0;i<1800;i++){
   const x=advanceVillageBrain(a,p,.07,{canVisit:()=>true});
   const y=advanceVillageBrain(b,q,.07,{canVisit:()=>true});
   assert.deepEqual(x,y);
   p={x:p.x+x.dx,z:p.z+x.dz};q={x:q.x+y.dx,z:q.z+y.dz};
   assert.ok(distanceXZ(p,a.home)<a.profile.radius+1,'fugiu da área');
 }
 assert.ok(a.walkCount>=3,'não visitou rotas suficientes');
 assert.ok(a.steps>0,'não caminhou');
});
test('interação com jogador para movimento e vira personagem para conversar',()=>{
 const brain=makeVillageBrain({id:'borin',x:-7,z:-24});
 brain.state='walk';brain.goal={x:4,z:-18};
 const near={x:-4,z:-22};
 const paused=advanceVillageBrain(brain,{x:-7,z:-24},.08,{player:near});
 assert.equal(paused.state,'greet');
 assert.equal(paused.dx,0);assert.equal(paused.dz,0);
 const talking=advanceVillageBrain(brain,{x:-7,z:-24},.08,{player:near,dialogue:true});
 assert.equal(talking.state,'greet');
 const away=advanceVillageBrain(brain,{x:-7,z:-24},.08,{player:{x:80,z:80}});
 assert.equal(away.state,'rest');
});
test('detector de obstáculos troca o caminho, sem teleporte',()=>{
 const brain=makeVillageBrain({id:'tavi',x:-29,z:31});
 brain.state='walk';brain.goal={x:-12,z:40};
 let p={x:-29,z:31};
 for(let i=0;i<12;i++){
   const action=advanceVillageBrain(brain,p,.11,{blocked:true,canVisit:(x,z)=>z<80});
   assert.ok(Math.hypot(action.dx,action.dz)<.25);
 }
 assert.ok(brain.walkCount>=1,'não recalculou waypoint');
});
test('integração: grade espacial e contratos usam posição atual do NPC',()=>{
 const world=readFileSync(new URL('../src/world/World.js',import.meta.url),'utf8');
 const npc=readFileSync(new URL('../src/entities/VillageNPCs.js',import.meta.url),'utf8');
 const game=readFileSync(new URL('../src/game/Game.js',import.meta.url),'utf8');
 const asset=readFileSync(new URL('../src/entities/VillageGLBAssets.js',import.meta.url),'utf8');
 const grid=readFileSync(new URL('../src/utils/ObstacleGrid.js',import.meta.url),'utf8');
 assert.match(world,/return obstacle;/);
 assert.match(grid,/invalidate\(\)/);
 assert.match(npc,/moveWithCollisions\(/);
 assert.match(npc,/this\.world\.walkable\(/);
 assert.match(npc,/this\.world\.obstacleGrid\.invalidate\(\)/);
 assert.match(npc,/npc\.collider\.x=pos\.x/);
 assert.match(npc,/nearby\(position,limit=5\)/);
 assert.match(game,/this\.villagers\.update\(dt,this\.elapsed,/);
 assert.match(asset,/NPC_WALK_IN_PLACE/);
 assert.match(asset,/getValueSize\(\)\!==3/);
 assert.match(npc,/model\.actions\[next\]/);
});
