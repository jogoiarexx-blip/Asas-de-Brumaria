import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:760}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/src/main.js',async route=>{
 const r=await route.fetch(),s=await r.text();
 assert.ok(s.includes('new Game();'));
 await route.fulfill({response:r,body:s.replace('new Game();','window.__saddleQAGame=new Game();')});
});
try{
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>Boolean(window.__saddleQAGame),null,{timeout:30000});
 await page.locator('#start-btn').click();
 await page.waitForFunction(()=>{
   const g=window.__saddleQAGame;
   return g.hero.riderVisualReady&&g.dragon.externalDragonModel?.officialFury&&
    g.hero.glbClips?.[1]?.actions?.rideIdle;
 },null,{timeout:50000});
 const result=await page.evaluate(async()=>{
  const g=window.__saddleQAGame,d=g.dragon,h=g.hero;
  const foot=h.glbClips[0];
  const leg=h.glbRoots[0].getObjectByName('mixamorigLeftUpLeg')
    ??h.glbRoots[0].getObjectByName('mixamorig_LeftUpLeg');
  const startLeg=leg?.quaternion.clone();
  for(let i=0;i<40;i++)h.update(1/60,{axis:()=>0,isDown:()=>false},i/60);
  const idleProof={exists:!!foot.actions.idle,active:foot.active===foot.actions.idle,
    stationaryLeg:startLeg&&leg?leg.quaternion.angleTo(startLeg):null};
  d.mount();h.setMounted(true);
  const mountStarted=!!h._mountMotion;
  const mountFrom=h.rider.position.clone();
  h.update(1/60,{axis:()=>0,isDown:()=>false},0);
  const mountFirstStep=h.rider.position.distanceTo(mountFrom);
  const THREE=await import('three');
  const {dragonCameraFraming}=await import('./src/game/dragonCameraFraming.js');
  const model=d.externalDragonModel;
  const frame=dragonCameraFraming({riding:true,airborne:false,
    speed:d.speed,visualHeight:model.visualHeight,visualWingspan:model.visualWingspan});
  for(let i=0;i<90;i++)g.updateCamera(1/60);
  const actualCameraDistance=g.camera.position.distanceTo(d.group.position);
  const newSize=d.externalDragonModel;
  const mountSize={
    riderScale:h.rider.scale.x,
    footScale:h.group.scale.x,
    dragonVisualHeight:newSize.visualHeight,
    dragonWingspan:newSize.visualWingspan,
    species:d.speciesId
  };
  const bone=key=>h.glbRoots[1].getObjectByName('mixamorig'+key)
    ??h.glbRoots[1].getObjectByName('mixamorig_'+key)
    ??h.glbRoots[1].getObjectByName('mixamorig:'+key);
  const sample=state=>{
   d.pose=state;d.airborne=['takeoff','cruise'].includes(state);
   d.speed=state==='cruise'?28:state==='ground'?0:7;
   h.mountAnimationRemaining=0;
   for(let i=0;i<60;i++)h.update(1/60,{isDown:()=>false},i/60);
   d.visual.updateMatrixWorld(true);
   const forward=d.forward(),hips=bone('Hips').getWorldPosition(new THREE.Vector3());
   const left=bone('LeftHand').getWorldPosition(new THREE.Vector3());
   const right=bone('RightHand').getWorldPosition(new THREE.Vector3());
   const local=d.visual.worldToLocal(hips.clone());
   return {clip:h.glbClips[1].state,
     handAheadLeft:left.clone().sub(hips).dot(forward),
     handAheadRight:right.clone().sub(hips).dot(forward),
     pelvisClearance:local.y-d.externalDragonModel.saddle.y,
     riderZ:h.rider.position.z,saddleZ:d.externalDragonModel.saddle.z};
  };
  const ground=sample('ground'),flight=sample('cruise'),landing=sample('landing');
  const mountCompleted=!h._mountMotion;
  const riderScaleAtExit=h.rider.scale.x;
  const x=d.group.position.x+3.3,z=d.group.position.z+1.7;
  const dest=new THREE.Vector3(x,g.world.groundHeightAt(x,z,.52),z);
  d.dismount();h.setMounted(false,{dismountTarget:dest});
  const startedExit=!!h._dismountMotion;
  const exitDistanceStart=h.group.position.distanceTo(dest);
  for(let i=0;i<12;i++)h.update(1/60,{axis:()=>1,isDown:()=>true},i/60);
  const exitDistanceMiddle=h.group.position.distanceTo(dest);
  for(let i=12;i<80;i++)h.update(1/60,{axis:()=>1,isDown:()=>true},i/60);
  const exitDistanceEnd=h.group.position.distanceTo(dest);
  const dismountCompleted=!h._dismountMotion;
  const riderScaleAfter=h.rider.scale.x;
  return {ground,flight,landing,oldBodyHidden:!h.rider.userData.body.visible,
    parentValid:h.rider.parent===d.visual,saddle:d.externalDragonModel.saddle,
    mountSize,idleProof,frame,actualCameraDistance,
    mountProof:{started:mountStarted,firstStep:mountFirstStep,completed:mountCompleted},
    exitProof:{started:startedExit,begin:exitDistanceStart,mid:exitDistanceMiddle,
      end:exitDistanceEnd,completed:dismountCompleted,
      scaleRetained:riderScaleAtExit===riderScaleAfter}};
 });
 for(const [name,p] of Object.entries({ground:result.ground,flight:result.flight,landing:result.landing})){
  assert.ok(p.handAheadLeft>.13&&p.handAheadRight>.13,`${name}: hands backwards: ${JSON.stringify(p)}`);
  assert.ok(Math.abs(p.pelvisClearance)<.16,`${name}: saddle gap: ${JSON.stringify(p)}`);
  assert.ok(Math.abs(p.riderZ-p.saddleZ)<.24,`${name}: rider shifted backward: ${JSON.stringify(p)}`);
 }
 assert.ok(Math.abs(result.mountSize.riderScale-result.mountSize.footScale)<.0001,
   'The hero changed size on mount: '+JSON.stringify(result.mountSize));
 assert.ok(Math.abs(result.mountSize.riderScale-1)<.0001);
 assert.ok(result.mountSize.dragonVisualHeight>3.2&&result.mountSize.dragonVisualHeight<3.46,
   'Fury is too small to carry a full-size rider: '+JSON.stringify(result.mountSize));
 assert.ok(result.mountSize.dragonWingspan>8.6);
 assert.equal(result.idleProof.exists,true,'GLB original lacks a standing idle');
 assert.equal(result.idleProof.active,true,'hero stands with foot idle animation');
 assert.ok(result.idleProof.stationaryLeg!==null&&result.idleProof.stationaryLeg<.005,
   'standing character should not march on the spot: '+JSON.stringify(result.idleProof));
 assert.ok(result.frame.distance>18,'camera too close to enlarged dragon: '+JSON.stringify(result.frame));
 assert.ok(result.actualCameraDistance>12,'3D camera still clips into large dragon');
 assert.equal(result.mountProof.started,true,'mount must begin with continuous travel from the player');
 assert.ok(result.mountProof.firstStep>.0001,'saddle mount did not move during first frame');
 assert.equal(result.mountProof.completed,true,'mount did not arrive at the saddle');
 assert.equal(result.exitProof.started,true,'safe dismount should animate instead of teleporting');
 assert.ok(result.exitProof.begin>result.exitProof.mid&&result.exitProof.mid>0,
   'dismount should approach saved ground position smoothly: '+JSON.stringify(result.exitProof));
 assert.ok(result.exitProof.end<.00001,'dismount never reached certified destination');
 assert.equal(result.exitProof.completed,true);
 assert.equal(result.exitProof.scaleRetained,true);
 assert.equal(result.oldBodyHidden,true);
 assert.equal(result.parentValid,true);
 assert.equal(result.ground.clip,'rideIdle');
 assert.equal(result.flight.clip,'rideFly');
 assert.equal(result.landing.clip,'rideLand');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'artifacts/cavaleiro-sela-corrigido.png'});
 console.log('HERO_SADDLE_HANDS_FORWARD_PASS',JSON.stringify(result));
}catch(error){
 console.error('HERO_SADDLE_BROWSER_ERROR',error);
 try{await page.screenshot({path:'artifacts/cavaleiro-sela-falha.png'});}catch{}
 throw error;
}finally{await browser.close();}
