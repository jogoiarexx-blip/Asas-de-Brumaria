import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const address=process.env.BRUMARIA_TEST_URL??'http://127.0.0.1:8765/';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[],failedRequests=[];
page.on('pageerror',e=>errors.push(String(e.stack??e)));
page.on('requestfailed',r=>failedRequests.push(r.url()+': '+r.failure()?.errorText));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
await page.route('**/src/main.js',async route=>{
  const response=await route.fetch(),body=await response.text();
  if(!body.includes('new Game();'))throw Error('Game QA hook absent');
  await route.fulfill({response,body:body.replace('new Game();','window.__dragonOfficialQA=new Game();')});
});
function snapshot(){
  return page.evaluate(()=>{
    const game=window.__dragonOfficialQA,d=game?.dragon,m=d?.externalDragonModel;
    const original=m?.original??[];
    let meshCount=0,skinned=0,joints=0;
    m?.root?.traverse?.(node=>{
      if(node.isMesh)meshCount++;
      if(node.isSkinnedMesh){skinned++;joints=Math.max(joints,node.skeleton?.bones?.length??0);}
    });
    return {species:game?.progression?.species,
      loaded:!!m,modelSpecies:m?.species,meshCount,skinned,joints,
      originalCount:original.length,proceduralVisible:original.filter(({obj})=>obj.visible).length,
      riderVisible:d?.rider?.visible,dragonStatus:document.querySelector('#dragon-model-status')?.textContent,
      state:document.querySelector('#dragon-model-status')?.dataset.state,
      clips:Object.keys(m?.slots??{})};
  });
}
try{
  await page.goto(address,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__dragonOfficialQA,null,{timeout:35000});
  await page.waitForFunction(()=>{
    const state=document.querySelector('#dragon-model-status')?.dataset.state;
    return state==='ok'||state==='error'||state==='missing';
  },null,{timeout:90000});
  const manifestDebug=await page.evaluate(async()=>{
    const mod=window.__dragonOfficialQA?.speciesModels;
    const url=new URL('../../assets/models/dragon-species.json',mod?.base);
    let response;let body;
    try{
      const fetchResponse=await fetch(url,{cache:'reload'});
      response={status:fetchResponse.status,url:fetchResponse.url,ok:fetchResponse.ok};
      body=(await fetchResponse.text()).slice(0,500);
    }catch(error){body=String(error);}
    return {base:mod?.base,url:url.href,loadedManifest:await mod?.manifest(),
      response,body,pending:[...mod?.pending?.keys()??[]],readCache:[...mod?.local?.keys()??[]]};
  });
  console.log('OFFICIAL_FURY_MANIFEST_DEBUG',JSON.stringify(manifestDebug));
  const first=await snapshot();
  console.log('OFFICIAL_FURY_AUTO',JSON.stringify(first));
  console.log('OFFICIAL_FURY_NET_ERRORS',JSON.stringify(failedRequests));
  assert.equal(first.state,'ok','Falha no carregamento oficial: '+first.dragonStatus+' '+errors.join('; '));
  assert.equal(first.species,'furia_noite');
  assert.equal(first.modelSpecies,'furia_noite');
  assert.ok(first.originalCount>4,'Não foram guardadas as malhas procedurais');
  assert.equal(first.proceduralVisible,0,'O dragão antigo ainda está visível!');
  assert.equal(first.joints,49,'GLB de Fúria da Noite não tem 49 ossos');
  for(const name of ['idle','walk','fly','glide','attack','hurt','takeoff','land'])
    assert.ok(first.clips.includes(name),'Animação GLB ausente: '+name);

  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  await page.waitForTimeout(350);
  await page.screenshot({path:'artifacts/furia-da-noite-auto-substituicao.png'});
  const after=await snapshot();
  assert.equal(after.proceduralVisible,0);
  assert.equal(after.joints,49);
  console.log('OFFICIAL_FURY_AUTO_PASS: dragon procedural fully hidden on boot');

  // Verify the second published model, without unlocking it to the player.
  const game=await page.evaluateHandle(()=>window.__dragonOfficialQA);
  await page.keyboard.press('t');
  await page.locator('#stable').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>{
    const d=window.__dragonOfficialQA?.stablePreview?.dragon;
    return !!d?.externalDragonModel?.root;
  },null,{timeout:90000});
  let preview=await page.evaluate(()=>{
    const d=window.__dragonOfficialQA?.stablePreview?.dragon;
    return {species:d?.externalDragonModel?.species,clips:Object.keys(d?.externalDragonModel?.slots??{})};
  });
  assert.equal(preview.species,'furia_noite','Prévia automática não usa modelo oficial inicial');
  await page.locator('[data-preview="furia_luz"]').click();
  await page.waitForFunction(()=>{
    const d=window.__dragonOfficialQA?.stablePreview?.dragon;
    return d?.externalDragonModel?.species==='furia_luz';
  },null,{timeout:90000});
  const unlocked=await page.evaluate(()=>window.__dragonOfficialQA.progression.unlocked.includes('furia_luz'));
  assert.equal(unlocked,false,'Preview leaked unlock of Light Fury');
  console.log('OFFICIAL_FURY_LIGHT_PREVIEW_PASS');
  await page.screenshot({path:'artifacts/furia-da-luz-auto-previa.png'});
  if(errors.length)throw Error('Erros JS: '+errors.join('; '));
}catch(error){
  console.error('OFFICIAL_FURY_AUTO_FAIL',error);
  try{await page.screenshot({path:'artifacts/furia-auto-falha.png',fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
