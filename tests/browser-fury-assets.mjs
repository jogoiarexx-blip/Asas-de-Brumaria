import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';

mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',message=>{
  if(message.type()==='error')errors.push('console '+message.text());
});
await page.route('**/src/main.js',async route=>{
  const response=await route.fetch(),source=await response.text();
  if(!source.includes('new Game();'))throw Error('QA hook Game constructor not found');
  await route.fulfill({response,body:source.replace('new Game();','window.__furyQAGame=new Game();')});
});
async function upload(id,path){
  const input=page.locator('#'+id);
  await input.setInputFiles({name:path.split('/').at(-1),mimeType:'model/gltf-binary',buffer:readFileSync(path)});
  await page.waitForFunction(()=>{
    const status=document.querySelector('#fury-glb-status');
    return ['ok','error'].includes(status?.dataset.state);
  },null,{timeout:45000});
  const status=await page.locator('#fury-glb-status').innerText();
  assert.equal(await page.locator('#fury-glb-status').getAttribute('data-state'),'ok',status);
}
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>Boolean(window.__furyQAGame),null,{timeout:30000});
  // The published dragon must replace the procedural original automatically.
  // Manual import must not be required for the initial Fury.
  try{
    await page.waitForFunction(()=>{
      const dragon=window.__furyQAGame?.dragon;
      return dragon?.externalDragonModel?.species==='furia_noite';
    },null,{timeout:45000});
  }catch(error){
    const detail=await page.evaluate(()=>{
      const game=window.__furyQAGame,models=game?.speciesModels,dragon=game?.dragon;
      return {selected:game?.progression?.species,modelSpecies:dragon?.externalDragonModel?.species,
        loadingId:models?.lastSelected,ready:models?.ready,
        error:String(models?.error?.stack??models?.error??'none'),
        pending:[...(models?.pending?.keys?.()??[])],
        visualChildren:dragon?.visual?.children?.map(x=>({name:x.name,visible:x.visible})),
        url:location.href,hasVendorLoader:!!document.querySelector('script[type="importmap"]')};
    });
    const network=await page.evaluate(async ()=>{
      const m=window.__furyQAGame?.speciesModels;
      const settled=async promise=>Promise.race([
        Promise.resolve(promise).then(value=>({settled:true,value})).catch(error=>({error:String(error)})),
        new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),1600))
      ]);
      const official=new URL('../../assets/models/dragon-species.json',m.base).href;
      const manifest=await settled(m.manifest());
      const queue=await settled(m.queue);
      const direct=await settled(fetch(official,{cache:'no-store'}).then(async r=>({status:r.status,body:await r.text()})));
      return {official,manifest,queue,direct,generation:m.generation,
        manualOverrides:[...m.manualOverrides??[]]};
    });
    console.error('FURY_AUTOLOAD_NETWORK',JSON.stringify(network));
    console.error('FURY_AUTOLOAD_DIAGNOSTICS',JSON.stringify(detail));
    console.error('FURY_BROWSER_ERRORS',JSON.stringify(errors));
    throw error;
  }
  const automatic=await page.evaluate(()=>{
    const dragon=window.__furyQAGame.dragon,model=dragon.externalDragonModel;
    return {species:model?.species,source:model?.source,
      visibleOriginals:model?.original?.filter(item=>item.obj.visible).length,
      modelRoots:dragon.visual.children.filter(obj=>obj.name==='ExternalDragonGLB').length,
      rigBones:model?.root?.getObjectByProperty('type','SkinnedMesh')?.skeleton?.bones?.length};
  });
  assert.equal(automatic.species,'furia_noite','initial 3D Fury was not installed');
  assert.equal(automatic.source,'species');
  assert.equal(automatic.visibleOriginals,0,'procedural dragon remains visible behind new Fury');
  assert.equal(automatic.modelRoots,1,'duplicate dragon GLB roots in the scene');
  assert.equal(automatic.rigBones,49,'wrong startup dragon model');
  console.log('FURY_AUTO_STARTUP_PASS',JSON.stringify(automatic));
  // Gameplay regression: real skinned bones must face the direction of
  // physical forward motion, while the feet stay near the terrain.
  const mechanics=await page.evaluate(async()=>{
    const THREE=await import('three');
    const game=window.__furyQAGame,d=game.dragon,m=d.externalDragonModel;
    const ground=game.world.groundHeightAt(d.group.position.x,d.group.position.z,1.65);
    const box=new THREE.Box3().setFromObject(m.root);
    const head=m.rig.getObjectByName('Bone_045').getWorldPosition(new THREE.Vector3());
    const tail=m.rig.getObjectByName('Bone_014').getWorldPosition(new THREE.Vector3());
    const heading=head.clone().sub(tail).normalize().dot(d.forward());
    const riderY=d.rider.position.y;
    const origin=d.group.position.clone();
    const controls=(forward=false,fly=false)=>({
      axis:(a,b)=>a==='w'?(forward?-1:0):0,
      isDown:key=>key==='space'&&fly
    });
    d.mount();game.hero.setMounted(true);
    for(let i=0;i<70;i++)d.update(1/60,controls(true),i/60);
    const advance=d.group.position.clone().sub(origin).dot(d.forward());
    const walkClip=d.externalDragonModel.active?.getClip()?.name;
    const walkRate=d.externalDragonModel.active?.getEffectiveTimeScale?.();
    for(let i=0;i<8;i++)d.update(1/60,controls(true,true),2+i/60);
    const takeoffClip=d.externalDragonModel.active?.getClip()?.name;
    const takeoffRate=d.externalDragonModel.active?.getEffectiveTimeScale?.();
    for(let i=0;i<85;i++)d.update(1/60,controls(true,true),3+i/60);
    const flyingClip=d.externalDragonModel.active?.getClip()?.name;
    d.airborne=false;d.takeoffTime=0;d.landingTimer=.4;
    d.update(1/60,controls(false),5);
    const landingClip=d.externalDragonModel.active?.getClip()?.name;
    d.dismount();game.hero.setMounted(false);d.group.position.copy(origin);
    d.verticalVelocity=0;d.pose='ground';d.landingTimer=0;d.update(1/60,controls(false),5.1);
    return {clearance:box.min.y-ground,heading,advance,riderY,walkClip,
      walkRate,takeoffClip,takeoffRate,flyingClip,landingClip};
  });
  assert.ok(mechanics.clearance>=-.25&&mechanics.clearance<.8,
    'Patas não encostam no terreno: '+JSON.stringify(mechanics));
  assert.ok(mechanics.heading>.8,'O focinho continua apontando para trás: '+JSON.stringify(mechanics));
  assert.ok(mechanics.advance>1,'Pressionar W não avançou na direção do focinho: '+JSON.stringify(mechanics));
  assert.ok(mechanics.riderY<0,'O cavaleiro continua suspenso acima da sela');
  assert.equal(mechanics.walkClip,'Walk');
  assert.equal(mechanics.takeoffClip,'Takeoff');
  assert.equal(mechanics.flyingClip,'Fly');
  assert.equal(mechanics.landingClip,'Landing');
  assert.ok(mechanics.walkRate>.65&&mechanics.takeoffRate>2,
    'Velocidades das animações não acompanham os estados de gameplay');
  console.log('FURY_GAMEPLAY_GROUND_DIRECTION_ANIMATION_PASS',JSON.stringify(mechanics));
  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  await page.keyboard.press('t');
  await page.locator('#stable').waitFor({state:'visible',timeout:10000});

  await upload('night-fury-glb-file','assets/models/furia-da-noite.glb');
  const main=await page.evaluate(()=>{
    const game=window.__furyQAGame,model=game.dragon.externalDragonModel;
    return {species:game.progression.species,modelSpecies:model?.species,
      joints:model?.root?.getObjectByProperty('type','SkinnedMesh')?.skeleton?.bones?.length,
      mapped:Object.keys(model?.slots??{}),rider:game.dragon.rider?.parent===game.dragon.visual};
  });
  assert.equal(main.species,'furia_noite');
  assert.equal(main.modelSpecies,'furia_noite');
  assert.equal(main.joints,49,'Fúria da Noite missing original skin');
  assert.ok(main.mapped.includes('fly')&&main.mapped.includes('attack'));
  assert.ok(main.rider,'Cavaleiro se desconectou do dragão');
  console.log('FURY_NIGHT_REAL',JSON.stringify(main));

  await upload('light-fury-glb-file','assets/models/furia-da-luz.glb');
  const light=await page.evaluate(()=>{
    const game=window.__furyQAGame,preview=game.stablePreview?.dragon?.externalDragonModel;
    return {selected:game.progression.species,unlocked:game.progression.unlocked.includes('furia_luz'),
      previewSpecies:preview?.species,
      previewJoints:preview?.root?.getObjectByProperty('type','SkinnedMesh')?.skeleton?.bones?.length,
      mapped:Object.keys(preview?.slots??{})};
  });
  assert.equal(light.selected,'furia_noite');
  assert.equal(light.unlocked,false,'Importing GLB unlocked Fúria da Luz');
  assert.equal(light.previewSpecies,'furia_luz');
  assert.equal(light.previewJoints,49);
  assert.ok(light.mapped.includes('glide')&&light.mapped.includes('land'));
  console.log('FURY_LIGHT_REAL',JSON.stringify(light));

  for(const motion of ['idle','walk','fly','glide','attack','hurt','takeoff','land']){
    await page.locator('#stable-preview-motion').selectOption(motion);
    await page.waitForTimeout(100);
  }
  await page.screenshot({path:'artifacts/furias-reais-estabulo.png'});
  if(errors.length)throw Error('Erros WebGL/JS no console: '+errors.join('; '));
  console.log('FURY_REAL_QA_PASS');
}catch(error){
  console.error('FURY_REAL_QA_ERROR',error);
  try{await page.screenshot({path:'artifacts/furias-erro.png'});}catch{}
  throw error;
}finally{await browser.close();}
