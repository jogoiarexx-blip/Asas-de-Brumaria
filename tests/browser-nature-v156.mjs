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
await page.route('**/src/main.js',async route=>{
 const response=await route.fetch(),source=await response.text();
 assert.ok(source.includes('    new Game();'));
 await route.fulfill({response,body:source.replace('    new Game();','    window.__natureQA=new Game();')});
});
try{
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!!window.__natureQA,null,{timeout:45000});
 await page.locator('#start-btn').click();
 await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
 await page.waitForFunction(()=>window.__natureQA?.started===true);
 const results=await page.evaluate(()=>{
   const g=window.__natureQA,w=g.world,cam=g.camera;
   const observer={x:0,y:24,z:0};
   const grass=w.grassByIsland.get('Ilha do Refúgio');
   if(!grass)throw Error('Grama do Refúgio não foi instanciada');
   w.setDetailQuality('quality');
   w.updateDetail(observer,1,null,cam);
   w.update(.15,12);
   w.updatePollen(12,observer);
   w.updateSeabirds(12,observer);
   g.renderer.render(g.scene,cam);
   const quality={
     grass:grass.count,totalGrass:grass.userData.totalCount,birds:w.birdMesh.count,
     pollen:w.pollenMesh.count,time:w.natureWind.time.value,
     wind:w.natureWind.strength.value,
     birdShader:typeof w.birdMesh.material.onBeforeCompile==='function',
     grassShader:typeof grass.material.onBeforeCompile==='function',
     birdsShared:w.birdMesh.isInstancedMesh,pollenShared:w.pollenMesh.isInstancedMesh,
     triangles:g.renderer.info.render.triangles
   };
   w.setDetailQuality('economy');
   w.updateDetail(observer,1,null,cam);
   w.update(.15,15);
   w.updatePollen(15,observer);
   w.updateSeabirds(15,observer);
   const economy={grass:grass.count,birds:w.birdMesh.count,pollen:w.pollenMesh.count};
   w.setDetailQuality('balanced');
   return {quality,economy,collisionCount:w.obstacles.length};
 });
 assert.ok(results.quality.totalGrass>=400,results.quality.totalGrass);
 assert.equal(results.quality.grass,results.quality.totalGrass);
 assert.ok(results.quality.birds>0,'Pássaros invisíveis ao redor do Refúgio');
 assert.ok(results.quality.pollen>0,'Pólen local não ativado no detalhado');
 assert.ok(results.quality.birdShader && results.quality.grassShader);
 assert.ok(results.quality.birdsShared && results.quality.pollenShared);
 assert.ok(results.quality.triangles>0,'WebGL não desenhou a cena');
 assert.ok(results.economy.grass<results.quality.grass);
 assert.ok(results.economy.birds<=results.quality.birds);
 assert.equal(results.economy.pollen,0);
 assert.ok(results.collisionCount>0);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'artifacts/nature-v156-browser.png'});
 console.log('NATURE_V156_BROWSER_PASS',JSON.stringify(results));
}catch(e){
 console.error('NATURE_V156_BROWSER_ERROR',e);
 try{await page.screenshot({path:'artifacts/nature-v156-error.png'});}catch{}
 throw e;
}finally{await browser.close()}
