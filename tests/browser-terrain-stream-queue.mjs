import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();
try{
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
 const data=await page.evaluate(async()=>{
   const {TerrainTextureManager,TERRAIN_STREAMING}=await import('./src/world/TerrainTextureManager.js');
   let inFlight=0,maxFlight=0,loads=[],uploads=[];
   const idle=[];
   const loader={async loadAsync(url){
     inFlight++;maxFlight=Math.max(inFlight,maxFlight);loads.push(url);
     await Promise.resolve();
     inFlight--;
     return {image:{width:url.includes('desktop')?2048:1024},
       dispose(){this.disposed=true},needsUpdate:false};
   }};
   const renderer={initTexture(texture){uploads.push(texture.image.width);}};
   const mat=()=>({map:null,normalMap:null,color:{setScalar(v){this.value=v}},needsUpdate:false});
   const manager=new TerrainTextureManager(renderer,{loader,idle:fn=>idle.push(fn)});
   const meadow=mat(),crystal=mat();
   manager.register('meadow',meadow);
   manager.register('crystal',crystal);
   const settle=async()=>{await Promise.resolve();await Promise.resolve();await new Promise(r=>setTimeout(r,0));};
   const drain=async(max=30)=>{
     for(let i=0;i<max;i++){
       await settle();
       if(idle.length){
         idle.shift()({didTimeout:true,timeRemaining:()=>40});
         continue;
       }
       if(!manager.busy&&!manager.queue.length)break;
     }
   };
   manager.setQuality('quality');
   await settle();
   const blankUntilIdle=meadow.map===null&&uploads.length===0;
   await drain();
   const full={diff:meadow.map?.image.width,
     normal:meadow.normalMap?.image.width,uploadCount:uploads.length};
   const originalLoads=loads.length;
   const islands=[{name:'Ilha do Refúgio',x:0,z:0,r:83},
     {name:'Arquipélago dos Cristais',biome:'crystal',x:-320,z:95,r:54}];
   manager.updateFocus({x:0,z:0},islands);
   manager.updateFocus({x:1500,z:1500},islands);await drain();
   const stillCached=meadow.map?.image.width===2048;
   manager.updateFocus({x:0,z:0},islands);await drain();
   const rapidReturn={requestsBefore:originalLoads,requestsAfter:loads.length,
     stillCached,restored:meadow.map?.image.width};
   manager.setQuality('balanced');
   await drain();
   const light={diff:meadow.map?.image.width,normal:meadow.normalMap,
     recycledOld:!manager.loading.has('./assets/textures/terrain/meadow_diff_desktop.webp')};
   manager.updateFocus({x:-320,z:95},islands);
   await drain();
   return {blankUntilIdle,maxFlight,full,rapidReturn,light,
     crystal:crystal.map?.image.width,
     uploads,loads,evictions:manager.stats.evictions,
     prefetch:TERRAIN_STREAMING.prefetchDistance};
 });
 assert.equal(data.blankUntilIdle,true,'textures were applied during update frame');
 assert.equal(data.maxFlight,1,'more than one large file loading concurrently');
 assert.deepEqual([data.full.diff,data.full.normal],[2048,2048]);
 assert.equal(data.full.uploadCount,2);
 assert.equal(data.rapidReturn.stillCached,true);
 assert.equal(data.rapidReturn.requestsAfter,data.rapidReturn.requestsBefore,'island turn re-downloaded texture');
 assert.equal(data.rapidReturn.restored,2048);
 assert.equal(data.light.diff,1024);
 assert.equal(data.light.normal,null);
 assert.equal(data.light.recycledOld,true,'obsolete GPU quality map was retained');
 assert.equal(data.crystal,1024);
 assert.ok(data.evictions>=2,'old quality maps were not disposed');
 assert.ok(data.prefetch>=200&&data.prefetch<=300);
 console.log('TERRAIN_STREAM_QUEUE_GPU_IDLE_PASS',JSON.stringify(data));
}catch(e){console.error('TERRAIN_STREAM_QUEUE_ERROR',e);throw e;}
finally{await browser.close();}
