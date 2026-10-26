import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANDMARKS} from '../src/systems/Discovery.js';
import * as collision from '../src/utils/collision.js';

const sample={x:42,z:24,ground:11};
const registered=(volumes)=>Array.isArray(volumes)&&volumes.length===2;

test('cada monumento cria colisores reais para base e coluna',()=>{
  assert.equal(typeof collision.landmarkCollisionVolumes,'function');
  const shapes=collision.landmarkCollisionVolumes(sample.x,sample.z,sample.ground);
  assert.ok(registered(shapes));
  assert.deepEqual(shapes.map(o=>o.type),['landmark-base','landmark-pillar']);
  assert.ok(shapes[0].radius>=4.3 && shapes[1].radius>=2.1);
  assert.equal(shapes[0].bottom,sample.ground);
  assert.ok(shapes[0].top>=sample.ground+1.5);
  assert.ok(shapes[1].top>=sample.ground+9.55);
});

test('os sete monumentos usam colisores na criação do cenário',()=>{
  assert.equal(LANDMARKS.length,7);
  const source=readFileSync(new URL('../src/world/Landmarks.js',import.meta.url),'utf8');
  assert.match(source,/landmarkCollisionVolumes/);
  assert.match(source,/world\.addObstacle\(/);
  assert.match(source,/world\.heightAt\(def\.x,def\.z\)/);
});

test('ao andar não é possível atravessar a base, mesmo com um passo longo',()=>{
  const obstacles=collision.landmarkCollisionVolumes(0,0,0);
  const result=collision.moveWithCollisions({x:-8,z:0},{x:18,z:0},.52,obstacles);
  assert.ok(result.x<=-4.55 && result.x>=-5,`Personagem atravessou o monumento: x=${result.x}`);
  assert.equal(result.blocked,true);
});

test('deslizamento tangencial contorna a base sem entrar no volume',()=>{
  const obstacles=collision.landmarkCollisionVolumes(0,0,0);
  const result=collision.moveWithCollisions({x:-5,z:-6},{x:0,z:12},.52,obstacles);
  assert.ok(result.z>5,`Movimento lateral foi bloqueado: z=${result.z}`);
  assert.equal(collision.overlapsCircle(result.x,result.z,.52,obstacles[0]),false);
});

test('coluna impede voo próximo, mas a base não bloqueia voo acima dela',()=>{
  const obstacles=collision.landmarkCollisionVolumes(0,0,0);
  assert.equal(collision.obstacleBlocks(obstacles[0],4,.9),false);
  assert.equal(collision.obstacleBlocks(obstacles[1],4,.9),true);
  assert.equal(collision.obstacleBlocks(obstacles[1],15,.9),false);
});

test('salvamento antigo dentro do monumento é reposicionado em um local livre',()=>{
  assert.equal(typeof collision.recoverFreePosition,'function');
  const obstacles=collision.landmarkCollisionVolumes(0,0,0);
  const oldSave={x:1.2,z:0};
  const safe=collision.recoverFreePosition(oldSave,.52,obstacles,()=>true,()=>true);
  assert.ok(safe,'deveria encontrar um local ao redor do monumento');
  assert.equal(collision.overlapsCircle(safe.x,safe.z,.52,obstacles[0]),false);
  assert.ok(Math.hypot(safe.x-oldSave.x,safe.z-oldSave.z)<8);
  const unchanged=collision.recoverFreePosition({x:8,z:0},.52,obstacles,()=>true,()=>true);
  assert.deepEqual({x:unchanged.x,z:unchanged.z},{x:8,z:0});
});

test('recuperação respeita altura da estrutura e pode recusar local inseguro',()=>{
  const obstacles=collision.landmarkCollisionVolumes(0,0,0);
  const altitudeSafe=collision.recoverFreePosition({x:1,z:0},1.65,obstacles,()=>true,o=>collision.obstacleBlocks(o,15,1.65));
  assert.deepEqual({x:altitudeSafe.x,z:altitudeSafe.z},{x:1,z:0});
  const noSpot=collision.recoverFreePosition({x:1,z:0},.52,obstacles,()=>false,()=>true);
  assert.equal(noSpot,null);
});

test('a restauração de save usa recuperação tanto para herói quanto para montaria',()=>{
  const source=readFileSync(new URL('../src/game/Game.js',import.meta.url),'utf8');
  const fn=source.split('  restoreSave(data){')[1]?.split('  updateGraphicsLabel()')[0]??'';
  assert.equal((fn.match(/recoverFreePosition\(/g)??[]).length,2);
  assert.match(fn,/heroX=safeHero\?\.x/);
  assert.match(fn,/dragonX=dragonSpot\?\.x/);
});
