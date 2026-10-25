import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dragonVisualScale,FURY_VISUAL_TARGET} from '../src/entities/dragonSizing.js';

function glbExtents(filename){
  const b=readFileSync(new URL('../assets/models/'+filename,import.meta.url));
  assert.equal(b.toString('ascii',0,4),'glTF');
  assert.equal(b.readUInt32LE(4),2);
  assert.equal(b.readUInt32LE(8),b.length);
  assert.equal(b.toString('ascii',16,20),'JSON');
  const document=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));
  const accessor=document.accessors.find(a=>a.type==='VEC3'&&a.min&&a.max&&a.min[1]<.02&&a.max[1]>1);
  assert.ok(accessor?.min&&accessor?.max,filename+' POSITION accessor absent');
  return Object.fromEntries(['x','y','z'].map((key,i)=>[key,accessor.max[i]-accessor.min[i]]));
}

test('no mounting shrink: pedestrian and rider retain identical visual scale',()=>{
  const hero=readFileSync(new URL('../src/entities/Hero.js',import.meta.url),'utf8');
  const loader=readFileSync(new URL('../src/entities/heroAssetLoader.js',import.meta.url),'utf8');
  assert.match(hero,/this\.rider\.scale\.setScalar\(1\)/);
  assert.doesNotMatch(hero,/this\.rider\.scale\.setScalar\(\.78\)/);
  assert.match(loader,/hero\.group\.add\(foot\);hero\.rider\.add\(rider\)/);
  assert.match(loader,/fitHeroSaddle\(hero\)/);
});

test('original night and light Furies are enlarged to a shared mount proportion',()=>{
  const night=glbExtents('furia-da-noite.glb');
  const light=glbExtents('furia-da-luz.glb');
  const hero=glbExtents('personagem_animado_montaria.glb');
  const heroHeight=2.23;
  assert.ok(Math.abs(hero.y-1.7)<.03);
  for(const [species,size] of [['noite',night],['luz',light]]){
    const old=dragonVisualScale(size,false);
    const updated=dragonVisualScale(size,true);
    const h=size.y*updated;
    const maxWidth=size.x*updated,maxDepth=size.z*updated;
    assert.ok(updated>old*1.43,JSON.stringify({species,old,updated}));
    assert.ok(h>heroHeight*1.42&&h<heroHeight*1.57,JSON.stringify({species,h}));
    assert.ok(maxWidth<=FURY_VISUAL_TARGET.wingspan+.001);
    assert.ok(maxDepth<=FURY_VISUAL_TARGET.length+.001);
    // Keep the model feet at the same height relative to the gameplay actor
    // (feet position is a translation, not a change to flight/ground physics).
    const alignedFeet=-2.48;
    assert.ok(Math.abs((2.58+alignedFeet)-.1)<1e-6);
  }
  const n=night.y*dragonVisualScale(night,true);
  const l=light.y*dragonVisualScale(light,true);
  assert.ok(Math.abs(n-l)<.05,'night and light Fury heights should match');
});

test('custom user dragon models retain the former fit and physics remains separate',()=>{
  const v={x:4.2,y:1.9,z:5};
  assert.equal(dragonVisualScale(v,false),Math.min(4.1/v.y,6/v.x,9/v.z));
  assert.throws(()=>dragonVisualScale({x:Infinity,y:2,z:3},true),/inválidas/);
  const loader=readFileSync(new URL('../src/entities/dragonAssetLoader.js',import.meta.url),'utf8');
  assert.match(loader,/dragonVisualScale\(size,officialFury\)/);
  assert.match(loader,/alignment\.position\.set\(center\.x\*scale,-2\.48-box\.min\.y\*scale,center\.z\*scale\)/);
  const dragon=readFileSync(new URL('../src/entities/Dragon.js',import.meta.url),'utf8');
  assert.match(dragon,/moveFlightWithCollisions\(/);
});
