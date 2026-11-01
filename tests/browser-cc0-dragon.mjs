import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';

const file='artifacts/cc0/cethiel-dragon.glb';
const bytes=readFileSync(file);
mkdirSync('artifacts/cc0',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});
await page.route('**/src/main.js',async route=>{
  const response=await route.fetch(),source=await response.text();
  if(!source.includes('    new Game();'))throw Error('QA hook not found');
  await route.fulfill({response,body:source.replace('    new Game();','    window.__cc0QA=new Game();')});
});
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__cc0QA,null,{timeout:40000});
  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  await page.waitForFunction(()=>window.__cc0QA?.started===true);
  await page.keyboard.press('t');
  await page.locator('#stable').waitFor({state:'visible',timeout:10000});
  await page.locator('#dragon-glb-file').setInputFiles({
    name:'cethiel-dragon.glb',mimeType:'model/gltf-binary',buffer:bytes
  });
  await page.waitForFunction(()=>{
    const e=document.querySelector('#dragon-glb-status');
    return e?.dataset.state==='ok'||e?.dataset.state==='error';
  },null,{timeout:30000});
  const status=await page.locator('#dragon-glb-status').innerText();
  assert.equal(await page.locator('#dragon-glb-status').getAttribute('data-state'),'ok',status);
  const result=await page.evaluate(()=>{
    const dragon=window.__cc0QA.dragon,m=dragon.externalDragonModel;
    const meshes=[];m.root.traverse(x=>{if(x.isMesh)meshes.push({name:x.name,skinned:!!x.isSkinnedMesh});});
    // Verify a real skeleton and imported animations, not a static placeholder.
    const originalHidden=m.original.every(({obj})=>!obj.visible);
    return {meshes,originalHidden,clips:Object.keys(m.slots),riderAttached:dragon.rider?.parent===dragon.visual,
      name:m.root.name,scale:m.scale};
  });
  console.log('CC0_DRAGON_BROWSER',JSON.stringify(result));
  assert.ok(result.meshes.some(x=>x.skinned),'The external model has no skinned meshes');
  assert.ok(result.originalHidden,'Procedural dragon is still showing beneath imported model');
  assert.ok(result.riderAttached,"The player's rider was detached");
  for(const required of ['idle','walk','attack','fly','glide'])
    assert.ok(result.clips.includes(required),'Missing '+required+' clip');
  // Verify the same converted model is also offered directly in the stable,
  // without asking the player to download and manually import a GLB.
  await page.locator('#dragon-glb-reset').click();
  await page.waitForFunction(()=>!window.__cc0QA.dragon.externalDragonModel,null,{timeout:10000});
  await page.locator('#dragon-glb-cc0').click();
  await page.waitForFunction(()=>{
    const e=document.querySelector('#dragon-glb-status');
    return e?.dataset.state==='ok'||e?.dataset.state==='error';
  },null,{timeout:20000});
  assert.equal(await page.locator('#dragon-glb-status').getAttribute('data-state'),'ok',
    'The built-in CC0 selection failed');
  assert.ok(await page.evaluate(()=>!!window.__cc0QA.dragon.externalDragonModel));
  console.log('CC0_BUILTIN_BUTTON PASS');
  await page.locator('#stable-close').click();
  await page.waitForTimeout(500);
  await page.screenshot({path:'artifacts/cc0/cethiel-in-game.png'});
  if(errors.length)throw Error('WebGL errors: '+errors.join('; '));
  await page.keyboard.press('t');
  await page.locator('#stable').waitFor({state:'visible'});
  await page.locator('#dragon-glb-reset').click();
  await page.waitForFunction(()=>!window.__cc0QA.dragon.externalDragonModel,null,{timeout:10000});
  console.log('CC0_DRAGON_BROWSER PASS: imported skinned GLB, animated and restored');
}catch(err){
  try{await page.screenshot({path:'artifacts/cc0/cethiel-failure.png'});}catch{}
  throw err;
}finally{await browser.close();}
