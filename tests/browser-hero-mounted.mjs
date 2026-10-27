import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1100,height:720}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/src/main.js',async route=>{
 const response=await route.fetch(),source=await response.text();
 if(!source.includes('new Game();'))throw Error('QA Game hook missing');
 await route.fulfill({response,body:source.replace('new Game();','window.__heroRigQAGame=new Game();')});
});
try{
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!!document.querySelector('#game canvas'),null,{timeout:40000});
 const rig=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {addMissingRiderClips,mountedMotionState,riderBoneNames}=await import('./src/entities/heroRiderAnimation.js');
  const names=riderBoneNames(),scene=new THREE.Group(),bones=[];
  for(const name of names){
   const bone=new THREE.Bone();
   bone.name=name.replace(/[:./]/g,'_');
   scene.add(bone);bones.push(bone);
  }
  const clips=addMissingRiderClips(scene,[]);
  const expected=['Mount','Riding_Idle','Riding_Walk','Riding_Takeoff',
   'Riding_Fly','Riding_Glide','Riding_Landing','Riding_Attack','Riding_Hurt','Dismount'];
  const mapped=clips.map(c=>c.name);
  const flying=clips.find(c=>c.name==='Riding_Fly');
  const mixer=new THREE.AnimationMixer(scene);
  const before=bones.find(b=>b.name==='mixamorig_LeftUpLeg').quaternion.clone();
  mixer.clipAction(flying).play();mixer.update(.22);
  const after=bones.find(b=>b.name==='mixamorig_LeftUpLeg').quaternion.clone();
  const movement=before.angleTo(after);
  const current=[
   mountedMotionState({pose:'ground',speed:0}),
   mountedMotionState({pose:'ground',speed:6}),
   mountedMotionState({pose:'takeoff'}),
   mountedMotionState({pose:'cruise',airborne:true,speed:32}),
   mountedMotionState({pose:'cruise',airborne:true,speed:8}),
   mountedMotionState({pose:'landing'}),
   mountedMotionState({attackTime:.2,pose:'cruise',airborne:true}),
   mountedMotionState({hurtTime:.2,pose:'ground'})
  ];
  // Existing author clips are never discarded or duplicated.
  const old=new THREE.AnimationClip('Walking',1,[]);
  const existing=addMissingRiderClips(scene,[old,flying]);
  return {count:clips.length,mapped,movement,states:current,
   originalsPreserved:existing.includes(old)&&existing.includes(flying),
   ridingDuplicates:existing.filter(c=>c.name==='Riding_Fly').length,
   jointCount:bones.length,rigReady:expected.every(n=>mapped.includes(n))};
 });
 assert.equal(rig.jointCount,18);
 assert.equal(rig.count,11);
 assert.ok(rig.movement>.25,'Rider leg bones were not animated: '+JSON.stringify(rig));
 assert.equal(rig.rigReady,true);
 assert.equal(rig.originalsPreserved,true);
 assert.equal(rig.ridingDuplicates,1);
 assert.deepEqual(rig.states,['rideIdle','rideWalk','rideTakeoff','rideFly','rideGlide','rideLand','rideAttack','rideHurt']);
 assert.deepEqual(errors,[]);
 console.log('HERO_RIDER_44_BONES_ANIMATION_PASS',JSON.stringify(rig));
 await page.locator('#start-btn').click();
 await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
 await page.keyboard.press('t');
 await page.locator('#stable').waitFor({state:'visible',timeout:16000});
 const data=await page.evaluate(async()=>{
  const {buildDemoGLB}=await import('./src/entities/demoGlb.js');
  return Array.from(buildDemoGLB());
 });
 await page.locator('#hero-glb-file').setInputFiles({
  name:'protagonista-teste.glb',mimeType:'model/gltf-binary',buffer:Buffer.from(data)
 });
 await page.waitForFunction(()=>
  document.querySelector('#hero-glb-status')?.dataset.state==='ok',null,{timeout:40000});
 const installed=await page.evaluate(()=>{
  const game=window.__heroRigQAGame,hero=game.hero,dragon=game.dragon;
  const before={roots:hero.glbRoots?.length,bodyHidden:!hero.group.userData.body.visible,
   riderHidden:!hero.rider.userData.body.visible,
   heroMounted:hero.mounted,dragonRig:hero.rider.parent===dragon.visual};
  dragon.mount();hero.setMounted(true);
  hero.update(.016,{axis:()=>0,isDown:()=>false},1);
  return {...before,heroMountedNow:hero.mounted,characterOnDragon:hero.rider.visible,
   sceneRootHidden:!hero.group.visible,mountRemaining:hero.mountAnimationRemaining};
 });
 assert.equal(installed.roots,2);
 assert.equal(installed.bodyHidden,true,'old walking character was not hidden');
 assert.equal(installed.riderHidden,true,'old procedural rider was not hidden');
 assert.equal(installed.dragonRig,true,'new rider should inherit dragon visual position');
 assert.equal(installed.heroMountedNow,true);
 assert.equal(installed.characterOnDragon,true);
 assert.equal(installed.sceneRootHidden,true);
 assert.ok(installed.mountRemaining>0);
 console.log('HERO_REPLACEMENT_AND_MOUNT_IN_GAME_PASS',JSON.stringify(installed));
}catch(error){console.error('HERO_RIDER_QA_ERROR',error);throw error;}
finally{await browser.close();}
