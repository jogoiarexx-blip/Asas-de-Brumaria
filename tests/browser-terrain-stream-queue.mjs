import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();
try{
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
 const data=await page.evaluate(async()=>{
   const {TerrainTextureManager}=await import('./src/world/TerrainTextureManager.js');
   let inFlight=0,maxFlight=0;const loads=[],uploads=[],idle=[];
   const loader={async loadAsync(url){
     inFlight++;maxFlight=Math.max(inFlight,maxFlight);loads.push(url);
     await Promise.resolve();inFlight--;
     return {image:{width:url.includes('_low')?512:url.includes('_mobile')?1024:2048},
       dispose(){this.disposed=true},needsUpdate:false};
   }};
   const renderer={initTexture(texture){uploads.push(texture.image.width);}};
   const material=()=>({map:null,normalMap:null,color:{setScalar(v){this.value=v}},needsUpdate:false});
   const manager=new TerrainTextureManager(renderer,{loader,idle:fn=>idle.push(fn)});
   const near={name:'Ilha do Refúgio',x:0,z:0,r:83};
   const remote={name:'Ilha das Cascatas',x:540,z:0,r:55};
   const first=material(),second=material();
   manager.register('meadow',first,near);manager.register('meadow',second,remote);
   const settle=async()=>{await Promise.resolve();await Promise.resolve();await new Promise(r=>setTimeout(r,0));};
   const drain=async(max=70)=>{for(let i=0;i<max;i++){
     await settle();if(idle.length){idle.shift()({didTimeout:true,timeRemaining:()=>40});continue;}
     if(!manager.busy&&!manager.queue.length)break;
   }};
   manager.setQuality('quality');
   const noEagerLoad=loads.length===0;
   manager.updateFocus({x:0,z:0},[near,remote]);
   const originalPlaceholder=first.map===manager.placeholder;
   await drain();
   const initial={near:first.map.image.width,far:second.map.image.width,
     normal:first.normalMap.image.width,loads:loads.length};
   manager.updateFocus({x:510,z:0},[near,remote]);await drain();
   const swapped={near:first.map.image.width,far:second.map.image.width};
   manager.setQuality('balanced');await drain();
   const balanced={far:second.map.image.width,normal:second.normalMap,
     highRemoved:![...manager.loading.keys()].some(x=>x.includes('_desktop'))};
   return {noEagerLoad,originalPlaceholder,maxFlight,initial,swapped,balanced,
     uploads,loads,evictions:manager.stats.evictions};
 });
 assert.equal(data.noEagerLoad,true,'textures must not be requested in the main menu');
 assert.equal(data.originalPlaceholder,true,'texture must wait for async idle upload');
 assert.equal(data.maxFlight,1,'more than one large texture loading concurrently');
 assert.deepEqual([data.initial.near,data.initial.far,data.initial.normal],[2048,512,2048]);
 assert.deepEqual([data.swapped.near,data.swapped.far],[512,2048]);
 assert.equal(data.balanced.far,1024);
 assert.equal(data.balanced.normal,null);
 assert.equal(data.balanced.highRemoved,true);
 assert.ok(data.evictions>=2);
 console.log('TERRAIN_ISLAND_DISTANCE_QUEUE_PASS',JSON.stringify(data));
}catch(e){console.error('TERRAIN_ISLAND_DISTANCE_QUEUE_ERROR',e);throw e;}
finally{await browser.close();}
