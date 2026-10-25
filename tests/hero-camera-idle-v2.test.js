import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dragonCameraFraming} from '../src/game/dragonCameraFraming.js';

test('enlarged Furies get more breathing room than the old fixed camera',()=>{
 const base=dragonCameraFraming({riding:true,visualHeight:2.16,visualWingspan:6,speed:16,zoom:1});
 const fury=dragonCameraFraming({riding:true,visualHeight:3.35,visualWingspan:9.35,speed:16,zoom:1});
 assert.ok(fury.distance>base.distance+2.6,{base,fury});
 assert.ok(fury.baseHeight>base.baseHeight+.5,{base,fury});
 assert.ok(fury.anchorHeight>base.anchorHeight);
 assert.ok(fury.lookHeight>base.lookHeight);
});

test('camera smoothly follows a faster dragon but preserves manual zoom',()=>{
 const walk=dragonCameraFraming({riding:true,visualHeight:3.35,visualWingspan:9.35,speed:0});
 const fly=dragonCameraFraming({riding:true,airborne:true,visualHeight:3.35,visualWingspan:9.35,speed:45});
 const zoomed=dragonCameraFraming({riding:true,airborne:true,visualHeight:3.35,visualWingspan:9.35,speed:45,zoom:.7});
 assert.ok(fly.distance>walk.distance);
 assert.ok(fly.baseHeight>walk.baseHeight);
 assert.ok(Math.abs(zoomed.distance-fly.distance*.7)<1e-8);
 assert.equal(zoomed.lookAhead,fly.lookAhead);
});

test('portrait mobile camera retains enough horizontal space for both enlarged wings',()=>{
 const desktop=dragonCameraFraming({riding:true,visualHeight:3.35,
   visualWingspan:9.35,speed:0,zoom:.65,aspect:16/9});
 const phone=dragonCameraFraming({riding:true,visualHeight:3.35,
   visualWingspan:9.35,speed:0,zoom:.65,aspect:.46});
 assert.ok(phone.distance>desktop.distance,
   'narrow screens need extra space around wings');
 const safeWidth=2*phone.distance*Math.tan((67*Math.PI/180)/2)*.46*.83;
 assert.ok(safeWidth>=9.35-1e-8,{safeWidth,phone});
 const walk=dragonCameraFraming({riding:false,zoom:.65,aspect:.46});
 assert.equal(walk.distance,11.5*.65,'on-foot mobile camera remains unchanged');
});

test('pedestrian framing and input direction remain unchanged',()=>{
 const expected={distance:11.5,baseHeight:6.15,anchorHeight:2.7,lookAhead:1.45,lookHeight:2};
 assert.deepEqual(dragonCameraFraming({riding:false,visualHeight:3.35,visualWingspan:9.35}),expected);
 const noDragon=dragonCameraFraming({riding:true,speed:0,zoom:1});
 assert.equal(noDragon.distance,15);
 const bad=dragonCameraFraming({riding:true,visualHeight:Infinity,visualWingspan:NaN,speed:NaN,zoom:NaN});
 assert.ok(Object.values(bad).every(Number.isFinite),JSON.stringify(bad));
});

test('official GLB idle is preserved and older five-clip character files gain a fallback',()=>{
 const raw=readFileSync(new URL('../assets/models/personagem_animado_montaria.glb',import.meta.url));
 const len=raw.readUInt32LE(12);
 const json=JSON.parse(raw.subarray(20,20+len).toString('utf8'));
 const names=json.animations.map(c=>c.name);
 assert.ok(names.includes('Walking'));
 assert.ok(names.includes('Idle'),names);
 assert.equal(names.filter(n=>n==='Idle').length,1,'do not duplicate the official Idle clip');
 const loader=readFileSync(new URL('../src/entities/heroAssetLoader.js',import.meta.url),'utf8');
 const idle=readFileSync(new URL('../src/entities/heroPedestrianIdle.js',import.meta.url),'utf8');
 assert.match(loader,/const synthesized=pedestrian\?createPedestrianIdle\(clipList\)/);
 assert.match(loader,/const footAnim=mixAnimations\(gltf.scene,gltf.animations\?\?\[\],\{pedestrian:true\}\)/);
 assert.match(idle,/clips\.some\(c=>/);
 assert.match(idle,/track\.createInterpolant\(\)\.evaluate\(target\)/);
 assert.match(idle,/new THREE\.AnimationClip\('Idle',3,tracks\)/);
});
