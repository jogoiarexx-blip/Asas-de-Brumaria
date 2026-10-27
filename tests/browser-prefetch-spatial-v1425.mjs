import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
  const data=await page.evaluate(async()=>{
    const {TerrainTextureManager}=await import('./src/world/TerrainTextureManager.js');
    const {ObstacleGrid}=await import('./src/utils/ObstacleGrid.js');
    const {predictFlightIsland}=await import('./src/world/IslandFlightPrefetch.js');
    const calls=[],idle=[];let active=0,peak=0;
    const loader={async loadAsync(url){active++;peak=Math.max(peak,active);calls.push(url);
      await Promise.resolve();active--;
      return {image:{width:512},dispose(){this.disposed=true}};}};
    const material={map:null,normalMap:null,color:{setScalar(){}},needsUpdate:false};
    const manager=new TerrainTextureManager({initTexture:()=>{}},{loader,idle:cb=>idle.push(cb)});
    const target={name:'Ilha do Farol',x:340,z:-70,r:55};
    manager.register('stone',material,target);
    const noMenuLoad=calls.length===0;
    const island=predictFlightIsland({x:0,z:0},{x:1,z:-.1},48,[
      {name:'Refúgio',x:0,z:0,r:83},target]);
    manager.prefetchAhead(island);
    for(let n=0;n<25;n++){
      await new Promise(resolve=>setTimeout(resolve,0));
      while(idle.length)idle.shift()({didTimeout:true,timeRemaining:()=>50});
      if(!manager.busy)break;
    }
    const loaded=[...manager.loading.keys()];
    const gridObstacles=Array.from({length:700},(_,i)=>({x:(i%35)*32-550,
      z:Math.floor(i/35)*32-310,radius:3,top:6,bottom:0}));
    const grid=new ObstacleGrid(()=>gridObstacles);
    const candidates=grid.queryCircle(18,20,3).length;
    manager.prefetchAhead(null);
    while(idle.length)idle.shift()({didTimeout:true,timeRemaining:()=>50});
    return {noMenuLoad,selected:island?.name,calls,loaded,peak,candidates,
      gridSize:gridObstacles.length,evicted:manager.loading.size===0};
  });
  assert.equal(data.noMenuLoad,true);
  assert.equal(data.selected,'Ilha do Farol');
  assert.deepEqual(data.calls,['./assets/textures/terrain/stone_diff_low.webp']);
  assert.deepEqual(data.loaded,data.calls);
  assert.equal(data.peak,1);
  assert.ok(data.candidates<data.gridSize*.15);
  assert.ok(data.evicted);
  console.log('BROWSER_SPATIAL_PREFETCH_PASS',JSON.stringify(data));
}finally{await browser.close();}
