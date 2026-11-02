import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const pageErrors=[],messages=[];
page.on('pageerror',err=>pageErrors.push(String(err)));
page.on('console',msg=>{if(/Vila GLB/.test(msg.text()))messages.push(msg.text());});
await page.route('**/src/main.js',async route=>{
  const response=await route.fetch(),source=await response.text();
  assert.ok(source.includes('    new Game();'));
  await route.fulfill({response,body:source.replace('    new Game();','    window.__villageQA=new Game();')});
});
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__villageQA,null,{timeout:45000});
  // Verify no 10–14MB NPC file is loaded on the menu before gameplay begins.
  const before=await page.evaluate(()=>({
    started:window.__villageQA.started,
    loaded:window.__villageQA.villagers.loadedModels.size
  }));
  assert.equal(before.started,false);
  assert.equal(before.loaded,0);
  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  await page.waitForFunction(()=>window.__villageQA?.started===true);
  await page.waitForFunction(()=>{
    const npcs=window.__villageQA.villagers.npcs.filter(n=>['iara','borin','tavi'].includes(n.spec.id));
    return npcs.every(n=>n.modelStatus==='ready'||n.modelStatus==='failed');
  },null,{timeout:180000,polling:350});
  const result=await page.evaluate(()=>{
    const g=window.__villageQA,people=g.villagers.npcs;
    const list=people.filter(n=>['iara','borin','tavi'].includes(n.spec.id));
    const extras=people.filter(n=>!['iara','borin','tavi'].includes(n.spec.id));
    const models=list.map(n=>{
      const holder=n.model?.holder;
      const scene=holder?.children?.[0];
      return {
        id:n.spec.id,name:n.spec.name,
        status:n.modelStatus,hasModel:!!n.model,
        fallback:n.body.visible,holderChildren:holder?.children?.length??0,
        matchedHeight:n.model?.visualHeight??null,
        actualHeight:n.model?.originalHeight??null,
        scaledHeight:(n.model?.originalHeight??0)*(n.model?.scale??0),
        scale:[scene?.scale.x,scene?.scale.y,scene?.scale.z],
        rootY:n.root.position.y,
        nearest:g.villagers.nearby(n.root.position)?.spec.id??null,
        clipCount:n.model?.info.animationCount??null,
        mixerEnabled:!!n.model?.mixer,
        syntheticIdle:n.model?.syntheticIdle??false
      };
    });
    return {models,unreplaced:extras.map(n=>({id:n.spec.id,fallback:n.body.visible})),
      status:g.villagers.loadedModels.size,
      failures:g.villagers.modelFailures.size,
      collisionCount:g.world.obstacles.filter(o=>o.type==='npc').length};
  });
  assert.equal(result.status,3,'Algum GLB único não foi aplicado: '+JSON.stringify({result,messages}));
  assert.equal(result.failures,0,'Houve fallback indevido: '+JSON.stringify({result,messages}));
  assert.equal(result.models.length,3);
  assert.equal(new Set(result.models.map(m=>m.name)).size,3);
  for(const m of result.models){
    assert.equal(m.status,'ready');
    assert.equal(m.hasModel,true);
    assert.equal(m.fallback,false,'Procedural deve ficar escondido');
    assert.equal(m.holderChildren,1,'GLB substitui apenas um NPC');
    assert.ok(m.mixerEnabled,'NPC GLB precisa ter animação Idle');
    assert.equal(m.syntheticIdle,true,'Running/Walking precisam de idle estático gerado');
    assert.ok(Math.abs(m.scaledHeight-m.matchedHeight)<1e-5,'Altura 1:1');
    assert.ok(m.scale.every(v=>Math.abs(v-m.scale[0])<1e-7),'Escala não uniforme');
    assert.equal(m.nearest,m.id,'Colisão/interação deve manter a posição');
  }
  assert.ok(result.unreplaced.every(n=>n.fallback),'Outros NPCs devem permanecer');
  assert.equal(result.collisionCount,6);
  assert.deepEqual(pageErrors,[]);
  await page.screenshot({path:'artifacts/v157-npcs-exclusivos.png'});
  console.log('V157_VILLAGE_NPCS_1_TO_1_PASS',JSON.stringify({result,messages}));
}catch(error){
  console.error('V157_VILLAGE_NPCS_ERROR',error);
  try{await page.screenshot({path:'artifacts/v157-npcs-erro.png'});}catch{}
  throw error;
}finally{await browser.close();}
