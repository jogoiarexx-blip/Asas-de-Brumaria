import {chromium} from 'playwright';
import assert from 'node:assert/strict';
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
  await route.fulfill({response,body:source.replace('    new Game();','    window.__villageAIQA=new Game();')});
});
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__villageAIQA,null,{timeout:45000});
  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  await page.waitForFunction(()=>window.__villageAIQA?.started===true);
  await page.waitForFunction(()=>window.__villageAIQA?.villagers.loadedModels.size===3,
    null,{timeout:120000,polling:500});
  const result=await page.evaluate(()=>{
    const game=window.__villageAIQA,group=game.villagers,world=game.world;
    const original=group.npcs.map(n=>({id:n.spec.id,x:n.root.position.x,z:n.root.position.z}));
    const movement=new Map(group.npcs.map(n=>[n.spec.id,{maxDistance:0,walk:false,rest:false}]));
    // Force the whole village into view solely for the deterministic simulated
    // walk test. Normal gameplay still uses actor LOD and streaming.
    group.npcs.forEach(n=>{n.root.visible=true;n.brain.rest=.03;});
    for(let i=0;i<640;i++){
      group.update(.085,i*.085,null,false);
      for(const n of group.npcs){
        const from=original.find(o=>o.id===n.spec.id),state=movement.get(n.spec.id);
        state.maxDistance=Math.max(state.maxDistance,
          Math.hypot(n.root.position.x-from.x,n.root.position.z-from.z));
        if(n.brain.state==='walk')state.walk=true;
        if(n.brain.state==='rest')state.rest=true;
      }
    }
    const people=group.npcs.map(n=>{
      const ground=world.heightAt(n.root.position.x,n.root.position.z);
      const collider=world.obstacleGrid.queryCircle(n.root.position.x,
        n.root.position.z,1).includes(n.collider);
      const point=n.root.position;
      return {id:n.spec.id,name:n.spec.name,modelStatus:n.modelStatus,
        activeClip:n.model?.active??null,walkAction:!!n.model?.actions?.walk,
        from:original.find(o=>o.id===n.spec.id),
        x:point.x,z:point.z,y:point.y,
        goal:n.brain.goal,walkCount:n.brain.walkCount,
        steps:n.brain.steps,mode:n.brain.state,
        ...movement.get(n.spec.id),
        onTerrain:world.walkable(point.x,point.z),
        groundError:Math.abs(ground-point.y),
        colliderIndexed:collider,nearby:group.nearby(point)?.spec.id
      };
    });
    const subject=group.npcs.find(n=>n.spec.id==='iara');
    const pos=subject.root.position;
    const beforeX=pos.x,beforeZ=pos.z;
    const player={x:pos.x+2.2,z:pos.z+1.8};
    group.update(.1,70,player,true);
    const interaction={
      stopped:Math.hypot(pos.x-beforeX,pos.z-beforeZ)<1e-6,
      greet:subject.brain.state,
      nearby:group.nearby(player,5.5)?.spec.id,
      quest:game.contracts.talk(subject.spec.id)?.action
    };
    game.renderer.render(game.scene,game.camera);
    return {people,interaction,colliders:world.obstacles.filter(o=>o.type==='npc').length,
      loaded:group.loadedModels.size,failures:group.modelFailures.size};
  });
  assert.equal(result.loaded,3,'GLBs não carregaram');
  assert.equal(result.failures,0);
  assert.equal(result.colliders,6);
  for(const npc of result.people){
    assert.ok(npc.walk,'Nunca entrou em estado caminhada: '+JSON.stringify(npc));
    assert.ok(npc.rest,'Nunca descansou: '+JSON.stringify(npc));
    assert.ok(npc.steps>0,'Não houve caminhada: '+JSON.stringify(npc));
    assert.ok(npc.maxDistance>=.7,'Movimento insuficiente: '+JSON.stringify(npc));
    assert.equal(npc.onTerrain,true,'NPC fora da ilha: '+JSON.stringify(npc));
    assert.ok(npc.groundError<.025,'NPC flutuando: '+JSON.stringify(npc));
    assert.ok(npc.colliderIndexed,'Colisão NPC não acompanhou o movimento: '+JSON.stringify(npc));
    assert.equal(npc.nearby,npc.id,'Interação não acompanha o NPC: '+JSON.stringify(npc));
    if(['iara','borin','tavi'].includes(npc.id))assert.equal(npc.walkAction,true,
      'GLB sem animação andando: '+JSON.stringify(npc));
  }
  assert.equal(result.interaction.stopped,true);
  assert.equal(result.interaction.greet,'greet');
  assert.equal(result.interaction.nearby,'iara');
  assert.ok(['accepted','reminder'].includes(result.interaction.quest));
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'artifacts/v158-npcs-patrulhando.png'});
  console.log('V158_VILLAGE_AI_BROWSER_PASS',JSON.stringify(result));
}catch(error){
  console.error('V158_VILLAGE_AI_BROWSER_ERROR',error);
  try{await page.screenshot({path:'artifacts/v158-village-ai-error.png'});}catch{}
  throw error;
}finally{await browser.close()}
