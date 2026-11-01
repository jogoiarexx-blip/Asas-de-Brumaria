import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
await page.route('**/src/main.js',async route=>{
 const response=await route.fetch(),source=await response.text();
 assert.ok(source.includes('    new Game();'));
 await route.fulfill({response,body:source.replace('    new Game();','    window.__islandScaleQA=new Game();')});
});
try{
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>Boolean(window.__islandScaleQA),null,{timeout:45000});
 await page.locator('#start-btn').click();
 await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
 const result=await page.evaluate(async()=>{
  const game=window.__islandScaleQA;
  const {ISLANDS}=await import('./src/world/config.js');
  const {ORIGINAL_ISLAND_CENTERS}=await import('./src/world/IslandLayout.js');
  const coastline=ISLANDS.map(island=>{
   const base=ORIGINAL_ISLAND_CENTERS[island.name];
   const shell=[];
   for(let k=0;k<32;k++){
    const angle=k*Math.PI/16;
    // Sample just beyond the old walkable limit (92% radius).
    // Very low atolls are steep and their outer lip is not walkable.
    const x=island.x+Math.cos(angle)*base.r*.925;
    const z=island.z+Math.sin(angle)*base.r*.925;
    if(game.world.walkable(x,z))shell.push([x,z]);
   }
   return {name:island.name,radius:island.r,oldRadius:base.r,expandedLand:shell.length};
  });
  const atol=ISLANDS[4],ash=ISLANDS[6];
  const between={x:(atol.x+ash.x)/2,z:(atol.z+ash.z)/2};
  const emptySea=!game.world.walkable(between.x,between.z);
  game.dragon.group.position.set(ash.x,game.world.heightAt(ash.x,ash.z)+18,ash.z);
  game.dragon.airborne=true;
  game.saveGame(true);
  const saved=game.saveSystem.read();
  return {coastline,emptySea,newLayout:saved?.layoutVersion,saveX:saved?.player?.x,expectedX:ash.x,
   mountainSafe:ash.x+ash.r<650,renderer:!!game.renderer,started:game.started};
 });
 assert.ok(result.coastline.every(i=>i.radius>i.oldRadius&&i.expandedLand>0),
   'Pelo menos uma ilha não ganhou terra transitável '+JSON.stringify(result));
 assert.ok(result.emptySea,'Passagem Atol-Cinzas perdeu o oceano');
 assert.equal(result.mountainSafe,true);
 assert.equal(result.newLayout,3);
 assert.equal(result.saveX,result.expectedX);
 assert.equal(result.started,true);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'artifacts/ilhas-maiores-travessia.png'});
 console.log('ISLAND_SCALE_V3_BROWSER_PASS',JSON.stringify(result));
}catch(error){
 console.error('ISLAND_SCALE_V3_BROWSER_ERROR',error);
 try{await page.screenshot({path:'artifacts/ilhas-v3-erro.png'});}catch{}
 throw error;
}finally{await browser.close()}
