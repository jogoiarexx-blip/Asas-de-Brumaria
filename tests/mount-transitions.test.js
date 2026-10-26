import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountTransitionPoint,MOUNT_TRANSITION_SECONDS,DISMOUNT_TRANSITION_SECONDS} from '../src/entities/mountTransition.js';

test('mount interpolation retains endpoints and 100% character scale',()=>{
  const start={x:-2,y:0,z:3},end={x:0,y:2.5,z:-.4};
  const a=mountTransitionPoint(start,end,0,MOUNT_TRANSITION_SECONDS);
  const mid=mountTransitionPoint(start,end,MOUNT_TRANSITION_SECONDS/2,MOUNT_TRANSITION_SECONDS);
  const done=mountTransitionPoint(start,end,MOUNT_TRANSITION_SECONDS,MOUNT_TRANSITION_SECONDS);
  assert.deepEqual({x:a.x,y:a.y,z:a.z},start);
  assert.equal(a.done,false);
  assert.equal(mid.progress,.5);
  assert.equal(mid.x,(start.x+end.x)/2);
  assert.ok(mid.y>(start.y+end.y)/2,'smooth arc during mount');
  assert.deepEqual({x:done.x,y:done.y,z:done.z},end);
  assert.equal(done.done,true);
  assert.deepEqual(start,{x:-2,y:0,z:3});
  assert.deepEqual(end,{x:0,y:2.5,z:-.4});
});

test('dismount clamps to verified safe destination without overshoot',()=>{
  const start={x:2,y:4,z:8},end={x:4,y:0,z:7};
  const samples=[0,.01,.15,.5,.77,1,5,Infinity].map(s=>
    mountTransitionPoint(start,end,s,DISMOUNT_TRANSITION_SECONDS,{arc:.23}));
  assert.ok(samples.every(s=>Object.values(s).every(v=>typeof v==='boolean'||Number.isFinite(v))));
  assert.ok(samples.slice(4).every(s=>s.done));
  assert.ok(samples.slice(4).every(s=>s.x===end.x&&s.y===end.y&&s.z===end.z));
  assert.equal(samples[0].z,start.z);
  assert.ok(samples[2].x>start.x&&samples[2].x<end.x);
});

test('mount and dismount animations are driven by a single continuous position, not mesh scaling',()=>{
  const hero=readFileSync(new URL('../src/entities/Hero.js',import.meta.url),'utf8');
  const game=readFileSync(new URL('../src/game/Game.js',import.meta.url),'utf8');
  const saddle=readFileSync(new URL('../src/entities/heroSaddleFit.js',import.meta.url),'utf8');
  assert.match(hero,/this\.rider\.scale\.setScalar\(1\)/);
  assert.match(hero,/this\._mountMotion=\{start,end,elapsed:0,duration:MOUNT_TRANSITION_SECONDS\}/);
  assert.match(hero,/this\._dismountMotion=\{start,end,elapsed:0,duration:DISMOUNT_TRANSITION_SECONDS\}/);
  assert.match(hero,/this\.advanceMountMotion\(dt\)/);
  assert.match(hero,/this\.advanceDismountMotion\(dt\)/);
  assert.match(game,/this\.hero\.setMounted\(false,\{dismountTarget:spot\}\)/);
  assert.match(game,/this\.hero\._dismountMotion\?\.end\?\?this\.hero\.group\.position/);
  assert.match(game,/this\.hero\.setMounted\(true,\{animate:false\}\)/);
  assert.match(saddle,/if\(hero\._mountMotion\)hero\._mountMotion\.end\.set/);
});
