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
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/src/main.js',async route=>{
 const response=await route.fetch(),source=await response.text();
 assert.ok(source.includes('new Game();'));
 await route.fulfill({response,body:source.replace('new Game();','window.__terrainQA=new Game();')});
});
try{
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>Boolean(window.__terrainQA),null,{timeout:30000});
 await page.locator('#start-btn').click();
 await page.waitForFunction(()=>{
  const manager=window.__terrainQA?.world?.terrainTextures;
  return !!manager?.materials.get('meadow')?.some(m=>m.map?.image?.width>=1024);
 },null,{timeout:60000});
 const result=await page.evaluate(async()=>{
  const game=window.__terrainQA,world=game.world,m=world.terrainTextures;
  const start={tier:m.tier,active:[...m.activeKinds],
    meadowTexture:m.materials.get('meadow')[0].map?.image?.width??0,
    meadowUV:world.scene.children.filter(x=>x.isMesh&&x.geometry?.attributes?.uv&&
      x.geometry.attributes.position?.count>2200).length,
    normalInBalanced:!!m.materials.get('meadow')[0].normalMap};
  game.hero.group.position.set(-320,world.heightAt(-320,95),95);
  game.dragon.group.position.set(-320,45,95);
  m.updateFocus({x:-320,y:35,z:95},[{name:'Arquipélago dos Cristais',x:-320,z:95,r:54,biome:'crystal'}]);
  return {start,frontierActive:[...m.activeKinds],
    meadowReleased:m.materials.get('meadow').every(mat=>mat.map===null)};
 });
 await page.waitForFunction(()=>{
  const m=window.__terrainQA?.world?.terrainTextures;
  return !!m?.materials.get('crystal')?.some(mat=>mat.map?.image?.width>=1024);
 },null,{timeout:60000});
 const after=await page.evaluate(()=>{
  const g=window.__terrainQA,m=g.world.terrainTextures,mat=m.materials.get('crystal')[0];
  // Switch to detailed tier and check real normal map is decoded.
  g.graphics.mode='quality';g.graphics.tier='quality';g.graphics.apply();
  g.world.setDetailQuality('quality');
  return {crystalImage:mat.map?.image?.width??0,currentlyActive:[...m.activeKinds]};
 });
 await page.waitForFunction(()=>{
  const g=window.__terrainQA,m=g.world.terrainTextures,mat=m.materials.get('crystal')[0];
  return !!(mat.map?.image?.width>=2048&&mat.normalMap?.image?.width>=2048);
 },null,{timeout:75000});
 const final=await page.evaluate(()=>{
  const g=window.__terrainQA,m=g.world.terrainTextures,mat=m.materials.get('crystal')[0];
  return {map:mat.map.image.width,normal:mat.normalMap.image.width,
    tier:m.tier,colorSpace:mat.map.colorSpace,
    uvCount:g.world.scene.children.filter(x=>x.isMesh&&x.geometry?.attributes?.uv&&
      x.geometry.attributes.position?.count>2200).length};
 });
 assert.ok(result.start.active.includes('meadow'));
 assert.equal(result.start.meadowTexture,1024);
 assert.equal(result.start.normalInBalanced,false);
 assert.equal(result.frontierActive.length,1);
 assert.equal(result.frontierActive[0],'crystal');
 assert.equal(result.meadowReleased,true);
 assert.equal(final.map,2048);
 assert.equal(final.normal,2048);
 assert.equal(final.tier,'desktop');
 assert.ok(final.uvCount>=7,'all seven island meshes should have continuous UVs');
 assert.deepEqual(errors,[],'no missing image or WebGL shader errors');
 await page.screenshot({path:'artifacts/terreno-polyhaven-cc0-alta-resolucao.png'});
 console.log('POLYHAVEN_CC0_TEXTURES_REAL_WEBGL_PASS',JSON.stringify({result,after,final}));
}catch(error){
 console.error('TERRAIN_TEXTURE_QA_FAILED',error);
 try{await page.screenshot({path:'artifacts/terreno-polyhaven-erro.png'});}catch{}
 throw error;
}finally{await browser.close();}
