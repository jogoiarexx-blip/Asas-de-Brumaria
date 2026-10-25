import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraRelativeMove,shortestYawDelta,steeringTraction} from '../src/game/cameraMovement.js';
import {CameraOrbit,cameraOffset} from '../src/game/CameraOrbit.js';
import {smoothedTurn,steeringRate} from '../src/entities/flightHandling.js';

const near=(a,b,epsilon=1e-7)=>Math.abs(a-b)<epsilon;
const heading=(x,z)=>Math.atan2(-x,-z);

test('camera ahead: W advances along the visible heading',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,1.2,-2.6]){
    const m=cameraRelativeMove(0,-1,yaw);
    assert.ok(near(m.x,-Math.sin(yaw))&&near(m.z,-Math.cos(yaw)),JSON.stringify({yaw,m}));
    assert.ok(near(shortestYawDelta(m.yaw,yaw),0));
  }
});
test('camera right vector stays perpendicular and diagonal stick is normalized',()=>{
  const right=cameraRelativeMove(1,0,Math.PI/2);
  assert.ok(near(right.x,0)&&near(right.z,-1));
  const diagonal=cameraRelativeMove(1,-1,Math.PI/3);
  assert.ok(near(Math.hypot(diagonal.x,diagonal.z),1));
  assert.ok(near(diagonal.strength,1));
  const half=cameraRelativeMove(.3,-.4,-2);
  assert.ok(near(half.strength,.5));
  assert.ok(near(Math.hypot(half.x,half.z),.5));
});
test('S walks backward relative to the view, A and D are screen-relative',()=>{
  for(const yaw of [-2,0,1.1,Math.PI]){
    const f=cameraRelativeMove(0,-1,yaw),b=cameraRelativeMove(0,1,yaw);
    const l=cameraRelativeMove(-1,0,yaw),r=cameraRelativeMove(1,0,yaw);
    assert.ok(near(f.x,-b.x)&&near(f.z,-b.z));
    assert.ok(near(l.x,-r.x)&&near(l.z,-r.z));
    assert.ok(near(f.x*r.x+f.z*r.z,0));
  }
});
test('camera pitch and zoom never change where W moves',()=>{
  const orbit=new CameraOrbit();
  orbit.drag(280,98);orbit.zoomBy(500);
  const before=cameraRelativeMove(0,-1,orbit.yaw);
  orbit.drag(0,100);
  assert.deepEqual(cameraRelativeMove(0,-1,orbit.yaw),before);
  const offset=cameraOffset({forwardX:0,forwardZ:-1,yaw:orbit.yaw,distance:14});
  assert.ok(near(heading(-offset.x,-offset.z),orbit.yaw));
});
test('shortest yaw and steering traction are stable across 180-degree turns',()=>{
  const d=shortestYawDelta(Math.PI-.01,-Math.PI+.01);
  assert.ok(near(d,.02));
  assert.equal(steeringTraction(Math.PI),0);
  assert.equal(steeringTraction(0),1);
  assert.ok(near(steeringTraction(Math.PI/3),.5));
});
test('mounted camera yaw can be reached smoothly without lateral reversal',()=>{
  let yaw=0,turnAxis=0;
  const target=-Math.PI/2,dt=1/60;
  for(let i=0;i<130;i++){
    const turn=Math.max(-1,Math.min(1,shortestYawDelta(yaw,target)/.65));
    turnAxis=smoothedTurn(turnAxis,turn,dt);
    yaw+=turnAxis*steeringRate(8,false)*dt;
    assert.ok(Number.isFinite(yaw));
  }
  assert.ok(Math.abs(shortestYawDelta(yaw,target))<.05,{yaw,target});
});
test('integration: Game, Dragon and Hero use identical camera yaw and collisions remain',()=>{
  const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
  const game=read('../src/game/Game.js'),dragon=read('../src/entities/Dragon.js'),hero=read('../src/entities/Hero.js');
  assert.match(game,/this\.input\.cameraYaw=this\.cameraOrbit\.yaw/);
  assert.match(game,/forwardX:0,forwardZ:-1,distance:framing\.distance,yaw/);
  assert.match(game,/dragonCameraFraming\(/);
  assert.match(game,/resolveCameraPosition\(/);
  assert.match(dragon,/cameraRelativeMove\(horizontalAxis,travel,input\.cameraYaw\)/);
  assert.match(dragon,/moveFlightWithCollisions\(/);
  assert.match(hero,/cameraRelativeMove\(intent\.x,intent\.z,input\.cameraYaw\)/);
  assert.match(hero,/moveWithCollisions\(/);
});
