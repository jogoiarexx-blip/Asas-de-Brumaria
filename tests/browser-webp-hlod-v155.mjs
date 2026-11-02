import assert from 'node:assert/strict';
import {chromium} from 'playwright';
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
 await route.fulfill({response,body:source.replace('    new Game();','    window.__impostorQA=new Game();')});
});
try{
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!!window.__impostorQA,null,{timeout:45000});
 await page.locator('#start-btn').click();
 await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
 await page.waitForFunction(()=>window.__impostorQA?.started===true);
 await page.waitForFunction(()=>window.__impostorQA?.world?.impostors?.textureReady?.size===4,null,{timeout:35000});
 const first=await page.evaluate(async()=>{
  const game=window.__impostorQA,world=game.world,cam=game.camera;
  const {ISLANDS}=await import('./src/world/config.js');
  const {coastGap}=await import('./src/world/IslandLayout.js');
  const {IMPOSTOR_PROFILES}=await import('./src/world/ImpostorRules.js');
  const THREE=await import('three');
  cam.position.set(12,35,40);
  for(let tick=0;tick<5;tick++)world.updateDetail(cam.position,1,null,cam);
  const graphics=world.impostors;
  const groups=[...graphics.groups.values()];
  const far=groups.flatMap(g=>g.batches).filter(b=>b.mesh.visible);
  if(!far.length)throw Error('As WebP distantes não apareceram');
  const batch=far[0],item=batch.items[0];
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion();
  batch.mesh.getMatrixAt(0,matrix);matrix.decompose(position,q,scale);
  const minGap=Math.min(...ISLANDS.flatMap((a,i)=>ISLANDS.slice(i+1).map(b=>coastGap(a,b))));
  return {islands:groups.length,proxyBatches:far.length,webp:graphics.getStatistics().webpReady,
   exactWidth:Math.abs(scale.x-item.bounds.width)<1e-4,
   exactHeight:Math.abs(scale.y-item.bounds.height)<1e-4,
   correctPivot:Math.abs(position.y-(item.y+item.bounds.centerY))<1e-4,
   minGap,profile:IMPOSTOR_PROFILES.balanced};
 });
 assert.equal(first.islands,7);
 assert.ok(first.proxyBatches>0);
 assert.ok(first.minGap>230);
 assert.ok(first.exactWidth&&first.exactHeight&&first.correctPivot,
  'WebP não reproduziu o tamanho/pivot do procedural');
 const next=await page.evaluate(async()=>{
  const game=window.__impostorQA,world=game.world,cam=game.camera;
  const {ISLANDS}=await import('./src/world/config.js');
  const island=ISLANDS[1];
  cam.position.set(island.x,40,island.z);
  world.detailStream.plan(cam.position,'balanced');
  for(let i=0;i<4;i++)world.detailStream.step(1);
  // Crossfade intentionally overlaps WebP and mesh for two streaming ticks.
  for(let i=0;i<3;i++)world.updateDetail(cam.position,1,null,cam);
  const group=world.impostors.groups.get(island.name);
  return {state:group.state,proxyVisible:group.batches.some(b=>b.mesh.visible),
   realMeshes:(world.foliageByIsland.get(island.name)??[]).filter(m=>m.visible).length,
   obstacleCount:world.obstacles.length};
 });
 assert.equal(next.state,'full');
 assert.equal(next.proxyVisible,false);
 assert.ok(next.realMeshes>0);
 assert.ok(next.obstacleCount>0);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'artifacts/v155-islands-webp.png'});
 console.log('WEBP_ISLAND_HLOD_V155_PASS',JSON.stringify({first,next}));
}catch(err){
 console.error('WEBP_ISLAND_HLOD_V155_ERROR',err);
 try{await page.screenshot({path:'artifacts/v155-error.png'});}catch{}
 throw err;
}finally{await browser.close()}
