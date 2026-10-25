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
  d.mount();h.setMounted(true);
  const THREE=await import('three');
  const bone=key=>h.glbRoots[1].getObjectByName('mixamorig_'+key);
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
  return {ground,flight,landing,oldBodyHidden:!h.rider.userData.body.visible,
    parentValid:h.rider.parent===d.visual,saddle:d.externalDragonModel.saddle};
 });
 for(const [name,p] of Object.entries({ground:result.ground,flight:result.flight,landing:result.landing})){
  assert.ok(p.handAheadLeft>.13&&p.handAheadRight>.13,`${name}: hands backwards: ${JSON.stringify(p)}`);
  assert.ok(Math.abs(p.pelvisClearance)<.16,`${name}: saddle gap: ${JSON.stringify(p)}`);
  assert.ok(Math.abs(p.riderZ-p.saddleZ)<.24,`${name}: rider shifted backward: ${JSON.stringify(p)}`);
 }
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
