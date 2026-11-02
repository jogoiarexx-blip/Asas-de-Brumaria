import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {natureBudget,grassDrawCount,birdFlightPose,natureGust,pollenDrift} from '../src/world/NatureLife.js';

test('grama: densidade dinâmica sem alterar instâncias e colisores',()=>{
 assert.equal(grassDrawCount(440,'quality'),440);
 assert.equal(grassDrawCount(440,'balanced'),335);
 assert.equal(grassDrawCount(440,'economy'),212);
 assert.equal(grassDrawCount(0,'quality'),0);
 assert.ok(natureBudget('economy').interval>natureBudget('quality').interval);
});
test('pássaros: trajetórias contínuas, sem teleportes ou divisão por zero',()=>{
 const bird={centerX:20,centerZ:-30,y:42,offset:2.1,speed:.35,radius:17,depth:13};
 for(const t of [0,1,20,400]){
  const pose=birdFlightPose(bird,t);
  for(const p of ['x','y','z','yaw','bank'])assert.ok(Number.isFinite(pose[p]),p);
  assert.ok(pose.y>39&&pose.y<45.5);
  assert.ok(Math.abs(pose.bank)<=.19);
  const next=birdFlightPose(bird,t+.016);
  assert.ok(Math.hypot(pose.x-next.x,pose.z-next.z)<.18);
 }
 assert.equal(typeof birdFlightPose(bird,0).glide,'boolean');
});
test('vento e partículas: intensidades limitadas e determinísticas',()=>{
 const calm=natureGust(2,0),strong=natureGust(2,1.6);
 assert.ok(strong>calm);
 assert.ok(natureGust(1,50)<=1.9);
 assert.ok(natureGust(2,-10)>=.22);
 assert.deepEqual(pollenDrift(3,2),pollenDrift(3,2));
 for(const i of [0,4,19])for(const t of [0,1,80])
  assert.ok(Object.values(pollenDrift(i,t)).every(Number.isFinite));
});
test('integração: vento na GPU mantém raízes da grama e não refaz geometria por frame',()=>{
 const shader=readFileSync(new URL('../src/world/NatureShaders.js',import.meta.url),'utf8');
 assert.match(shader,/position\.y\/1\.12/);
 assert.match(shader,/blade\*blade/);
 assert.match(shader,/transformed\.x\+=/);
 assert.match(shader,/instanceMatrix\[3\]\.xz/);
 assert.match(shader,/uNaturePlayer/);
 assert.match(shader,/tip\*tip\*flap/);
 assert.match(shader,/customProgramCacheKey/);
 const world=readFileSync(new URL('../src/world/World.js',import.meta.url),'utf8');
 assert.match(world,/installGrassWind\(material,this\.natureWind\)/);
 assert.match(world,/installBirdWingMotion\(material,this\.birdWingTime\)/);
 assert.match(world,/this\.birdMesh=new THREE\.InstancedMesh/);
 assert.match(world,/this\.pollenMesh=new THREE\.InstancedMesh/);
 assert.match(world,/this\.natureWind\.time\.value=time/);
 assert.match(world,/this\.birdMesh\.count=visible/);
 assert.match(world,/this\.pollenMesh\.count=count/);
 assert.match(world,/this\.addObstacle\(x,y,z,\.82\*size,5\.2\*size,'tree'\)/);
});
