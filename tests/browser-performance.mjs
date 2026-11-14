import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';

// These numbers compare identical CI SwiftShader scenes. They are not
// representative of a player's GPU FPS; draw calls/triangles are objective.
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.stack??e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/src/main.js',async route=>{
  const response=await route.fetch(),source=await response.text();
  const token='    new Game();';
  if(!source.includes(token))throw Error('Missing QA hook');
  await route.fulfill({response,body:source.replace(token,'    window.__brumariaPerfGame=new Game();')});
});
const url=process.env.BRUMARIA_TEST_URL??'http://127.0.0.1:8765/';
const reports=[];
async function measure(name){
  await page.waitForTimeout(500);
  const result=await page.evaluate(async()=>{
    const game=window.__brumariaPerfGame,frames=[];
    let last=0;
    for(let i=0;i<100;i++){
      const t=await new Promise(resolve=>requestAnimationFrame(resolve));
      if(last)frames.push((t-last)/1000);
      last=t;
    }
    const sorted=frames.slice().sort((a,b)=>a-b);
    const avg=frames.reduce((a,b)=>a+b,0)/frames.length;
    const info=game.renderer.info,canvas=game.renderer.domElement;
    return {tier:game.graphics.tier,fps:Math.round(1/avg*10)/10,
      p95ms:Math.round(sorted[Math.floor(sorted.length*.95)]*10000)/10,
      drawCalls:info.render.calls,triangles:info.render.triangles,
      geometries:info.memory.geometries,textures:info.memory.textures,
      pixelWidth:canvas.width,pixelHeight:canvas.height,
      islandCount:game.world.visibleIslandCount,
      sceneChildren:game.scene.children.length};
  });
  assert.ok(result.drawCalls>0&&result.triangles>0,'Invalid render stats: '+JSON.stringify(result));
  if(errors.length||await page.locator('#fatal').isVisible())throw Error('Browser crashed: '+errors.join(' '));
  reports.push({scene:name,...result});
  await page.screenshot({path:'artifacts/perf-'+name+'.png'});
  console.log('PERF_JSON '+JSON.stringify({scene:name,...result}));
}
try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__brumariaPerfGame,null,{timeout:45000});
  await page.locator('#start-btn').click();
  await page.evaluate(()=>{
    const g=window.__brumariaPerfGame;
    g.graphics.mode='balanced';g.graphics.tier='balanced';
    g.graphics.apply();g.applySceneQuality();
  });
  const rigBatches=await page.evaluate(()=>{
    const g=window.__brumariaPerfGame;
    const dragon=g.dragon,creatures=g.wildDragons.creatures;
    if(dragon.rigidBatchedParts<30)throw Error('Main dragon did not batch static details: '+dragon.rigidBatchedParts);
    if(!creatures.length||creatures.some(c=>c.rigidBatchedParts<7))
      throw Error('Wild dragon decoration batching missing');
    for(const pivot of [dragon.headPivot,dragon.jawPivot,dragon.neckCrest,...dragon.tail,
      ...dragon.wings.flatMap(w=>[w.wing,w.elbow,w.tip]),
      ...dragon.forelegs.flatMap(f=>[f.shoulder,f.wrist])])
      if(!pivot?.isGroup)throw Error('Articulated rig pivot was modified');
    if(dragon.pupils.length!==2||dragon.brows.length!==2||dragon.eyeBlink.length!==2)
      throw Error('Facial rig lost animated parts');
    const counts=creatures.map(c=>({
      species:c.spec.id,merged:c.rigidBatchedParts,
      eyes:c.eyes.length,ears:c.ears.length,wings:c.wings.length}));
    for(const c of counts)if(c.eyes!==2||c.ears!==2||c.wings!==2)
      throw Error('Wild animated facial rig broken: '+JSON.stringify(c));
    return {main:dragon.rigidBatchedParts,wild:counts};
  });
  console.log('DRAGON_BATCH '+JSON.stringify(rigBatches));
  await measure('village');
  const batching=await page.evaluate(()=>{
    const g=window.__brumariaPerfGame,birds=g.world.birdMesh;
    // v1.5.6 passou a 14/28/42 aves por nível; a cena é medida em EQUILIBRADO.
    if(!birds?.isInstancedMesh||birds.count<1||birds.count>28||g.world.birds.length<28)
      throw Error('Seabird instances missing');
    const before=new birds.matrixWorld.constructor(),after=before.clone();
    birds.getMatrixAt(0,before);
    g.world.updateSeabirds(g.elapsed+2.5);
    birds.getMatrixAt(0,after);
    if(before.equals(after))throw Error('Bird flight did not animate');
    g.renderer.render(g.scene,g.camera);
    const withBirds=g.renderer.info.render.calls;
    birds.visible=false;g.renderer.render(g.scene,g.camera);
    const withoutBirds=g.renderer.info.render.calls;
    birds.visible=true;
    if(withBirds-withoutBirds!==1)throw Error('Birds cost '+(withBirds-withoutBirds)+' draws instead of one');
    return {instances:birds.count,drawCalls:withBirds-withoutBirds};
  });
  console.log('BIRD_BATCH '+JSON.stringify(batching));
  await page.evaluate(()=>{
    const g=window.__brumariaPerfGame;
    g.dragon.mount();g.hero.setMounted(true);g.dragon.airborne=true;
    g.dragon.group.position.set(-129,39,148);
    g.dragon.speed=0;g.updateCamera(.2);g.world.updateDetail(g.camera.position,.5);
  });
  await measure('wild-dragons');
  await page.evaluate(async()=>{
    const g=window.__brumariaPerfGame;
    g.missions.stage=3;g.missions.refreshVisible();
    await g.loadMountain();
    g.expedition.boatHealth=[0,0,0];g.expedition.phase='boss';g.expedition.inRegion=true;
    g.inMountain=true;g.mountain.refresh();
    g.dragon.mount();g.hero.setMounted(true);g.dragon.airborne=true;
    g.dragon.group.position.set(1100,82,105);g.dragon.speed=0;
    g.updateCamera(.2);g.world.updateDetail(g.camera.position,.5);
  });
  await measure('mountain-boss');
  writeFileSync('artifacts/perf-metrics.json',JSON.stringify({environment:'GitHub Actions Ubuntu, headless Chromium with SwiftShader',results:reports},null,2));
}finally{await browser.close();}
