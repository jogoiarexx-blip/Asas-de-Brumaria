import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1120,height:720}});
const errors=[];
page.on('pageerror',err=>errors.push(String(err)));
await page.route('**/src/main.js',async route=>{
  const response=await route.fetch(),source=await response.text();
  if(!source.includes('    new Game();'))throw Error('Main entrypoint changed');
  await route.fulfill({response,body:source.replace('    new Game();','    window.__lodQA=new Game();')});
});
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__lodQA,null,{timeout:60000});
  const before=await page.evaluate(()=>{
    const w=window.__lodQA.world;
    return {jobs:w.detailStream.stats.jobs,loaded:w.detailStream.residentCount,
      foliage:w.foliageByIsland.size,grass:w.grassByIsland.size,flowers:w.flowersByIsland.size,
      colliders:w.obstacles.length,islands:w.terrainTextures.registrations.size};
  });
  assert.equal(before.jobs,0,'menu must not construct remote detail');
  assert.equal(before.loaded,1,'menu should have only starting island detail');
  assert.deepEqual([before.foliage,before.grass,before.flowers],[1,1,1]);
  assert.ok(before.colliders>250,'all collision volumes must remain independent');
  assert.equal(before.islands,7,'all terrain meshes remain loaded');
  await page.locator('#start-btn').click();
  await page.waitForFunction(()=>window.__lodQA?.started===true,null,{timeout:90000});
  const report=await page.evaluate(async()=>{
    const game=window.__lodQA,w=game.world;
    const {ISLANDS}=await import('./src/world/config.js');
    const target=ISLANDS.find(i=>i.name==='Arquipélago dos Cristais');
    const center={x:target.x,z:target.z,y:36};
    w.detailTier='balanced';
    w.updateDetail(center,.5);
    const pending=w.detailStream.pending;
    w.updateDetail(center,.016);
    const one=w.detailStream.stats.jobs;
    for(let i=0;i<5;i++)w.updateDetail(center,.016);
    const after=w.detailStream.stats.jobs;
    const required=['coast','foliage','grass','flowers'];
    const material=w.foliageByIsland.get(target.name)??[];
    return {pending,one,after,resident:w.detailStream.resident.has(target.name),
      phases:required.every(p=>w.detailStream.resident.get(target.name)?.has(p)),
      foliage:material.length,grass:w.grassByIsland.get(target.name)?.count??0,
      flowers:w.flowersByIsland.get(target.name)?.count??0,
      colliders:w.obstacles.length,stats:w.detailStream.stats};
  });
  assert.ok(report.pending>=3,'distant detail not queued near the destination');
  assert.ok(report.one>=1&&report.after>report.one,'not progressing across frames');
  assert.ok(report.resident&&report.phases,'island chunks were not generated');
  assert.ok(report.foliage>=5&&report.grass>30&&report.flowers>20,
    'quality vegetation was discarded rather than streamed');
  assert.equal(report.colliders,before.colliders,'collisions must never be loaded/unloaded');
  assert.deepEqual(errors,[],'browser page errors');
  console.log('BROWSER_ISLAND_LOD_STREAM_PASS',JSON.stringify({before,report}));
}finally{await browser.close();}
