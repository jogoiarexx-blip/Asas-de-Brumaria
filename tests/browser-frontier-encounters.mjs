import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1100,height:720}});
page.on('pageerror',e=>console.warn('PAGE_ERROR',String(e)));
await page.route('**/src/main.js',async route=>{
 const response=await route.fetch(),src=await response.text();
 assert.ok(src.includes('new Game();'));
 await route.fulfill({response,body:src.replace('new Game();','window.__frontierTestGame=new Game();')});
});
try{
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>Boolean(window.__frontierTestGame),null,{timeout:30000});
 await page.locator('#start-btn').click();
 const out=await page.evaluate(async()=>{
  const game=window.__frontierTestGame,frontier=game.frontier,dragon=game.dragon;
  const {FRONTIER_ZONES}=await import('./src/systems/FrontierRules.js');
  const THREE=await import('three');
  const initial={markers:frontier.found.size,guardians:frontier.guardians.size,
    drawn:FRONTIER_ZONES.map(zone=>{
      const m=frontier.markers.get(zone.id);
      return {core:m.cores.isInstancedMesh,ring:m.rings.isInstancedMesh,visible:m.cores.visible};
    })};
  const events=[];
  dragon.mount();game.hero.setMounted(true,{animate:false});dragon.airborne=true;
  // Purely controlled test: no level movement, user input or frame simulation.
  for(const zone of FRONTIER_ZONES){
    for(const record of frontier.markers.get(zone.id).points){
      dragon.group.position.set(record.x,record.y,record.z);
      for(const event of frontier.update(1/60,0,dragon,()=>{},false)){
        events.push(event);game.handleFrontierEvent(event);
      }
    }
  }
  const claimed=frontier.snapshot();
  let duplicate=0;
  for(const zone of FRONTIER_ZONES){
    const marker=frontier.markers.get(zone.id).points[0];
    dragon.group.position.set(marker.x,marker.y,marker.z);
    duplicate+=frontier.update(1/60,0,dragon,()=>{},false).length;
  }
  const restored=claimed;
  const clone=new (frontier.constructor)(game.scene,game.world,restored);
  const restoredState=clone.snapshot();
  clone.dispose();
  // Activate a single nearby sentinel in a late-game state.
  const zone=FRONTIER_ZONES[0],x=zone.x,z=zone.z;
  dragon.group.position.set(x,game.world.heightAt(x,z)+30,z);
  frontier.update(.016,1,dragon,()=>{},true);
  const guard=frontier.guardians.get(zone.id);
  const guardsBefore=frontier.activeGuardians.length;
  const from=guard.position.clone().add(new THREE.Vector3(0,0,15));
  const to=guard.position.clone().add(new THREE.Vector3(0,0,-15));
  const strike1=frontier.hitGuardian(from,to,2);
  const strike2=frontier.hitGuardian(from,to,2);
  const strike3=frontier.hitGuardian(from,to,2);
  const far=dragon.group.position.set(5,30,5);
  frontier.update(.016,2,dragon,()=>{},true);
  return {initial,events:events.map(e=>({type:e.type,zone:e.zone,points:e.points})),
    found:claimed.found,awarded:claimed.rewarded,duplicate,
    restoreEqual:JSON.stringify(restoredState)===JSON.stringify(restored),
    guardsBefore,strike1:strike1?.type,strike2:strike2?.type,
    strike3:strike3?.type,guardDefeated:frontier.defeated.has(zone.id),
    guardVisibleFar:guard.group.visible,nowActive:frontier.activeGuardians.length,
    fpsBudgetDrawCalls:initial.drawn.length*2};
 });
 assert.equal(out.initial.markers,0);
 assert.equal(out.initial.guardians,0,'enemies loaded before arriving');
 assert.ok(out.initial.drawn.every(item=>item.core&&item.ring&&!item.visible));
 assert.equal(out.found.length,6);
 assert.deepEqual(out.awarded,['crystal','ash']);
 assert.equal(out.events.filter(e=>e.type==='relic-complete').length,2);
 assert.equal(out.duplicate,0,'double rewards on entering same objective');
 assert.equal(out.restoreEqual,true);
 assert.equal(out.guardsBefore,1);
 assert.equal(out.strike1,'guardian-hit');
 assert.equal(out.strike2,'guardian-defeated');
 assert.equal(out.strike3,undefined);
 assert.equal(out.guardDefeated,true);
 assert.equal(out.guardVisibleFar,false);
 assert.equal(out.nowActive,0);
 await page.screenshot({path:'artifacts/fronteira-dois-guardioes.png'});
 console.log('FRONTIER_2_REGIONS_6_RELICS_GUARDIAN_LAZY_SAVE_PASS',JSON.stringify(out));
}catch(err){
 try{await page.screenshot({path:'artifacts/fronteira-browser-falha.png'});}catch{}
 console.error('FRONTIER_BROWSER_ERROR',err);throw err;
}finally{await browser.close();}
