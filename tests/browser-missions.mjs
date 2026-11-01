import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const url=process.env.BRUMARIA_TEST_URL??'http://127.0.0.1:8765/';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.stack??e)));
page.on('console',msg=>{if(msg.type()==='error')errors.push('console: '+msg.text());});

// Inject a reference only inside Playwright's local response, never into the
// actual repository or shipped game. Exercise the real Game, Missions,
// EnemyDragon, projectiles, saves and renderer with controlled fast-forwarding.
await page.route('**/src/main.js',async route=>{
  const res=await route.fetch();
  const source=await res.text();
  const anchor='    new Game();';
  if(!source.includes(anchor))throw Error('QA hook: Game constructor not found');
  await route.fulfill({response:res,body:source.replace(anchor,
    '    window.__brumariaQAGame=new Game();')});
});

async function check(label){
  const fatal=page.locator('#fatal');
  if(await fatal.isVisible())throw Error(label+': '+(await fatal.innerText()).slice(0,1500));
  if(errors.length)throw Error(label+': '+errors.join('\n').slice(0,1500));
  console.log('PASS: '+label);
}
async function run(label,fn){
  const value=await page.evaluate(fn);
  console.log('RESULT: '+label+': '+JSON.stringify(value));
  await check(label);
  return value;
}
try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__brumariaQAGame,null,{timeout:45000});
  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  await page.waitForFunction(()=>window.__brumariaQAGame?.started===true);
  await check('Cena inicial com Game real em execução');

  const rings=await run('Cinco aros e três cristais',()=>{
    const g=window.__brumariaQAGame;
    g.mountOrDismount();
    if(g.missions.stage!==1||!g.dragon.riding)throw Error('Montaria não abriu a missão dos aros');
    for(let i=0;i<5;i++){
      g.dragon.group.position.copy(g.missions.rings[i].position);
      g.missions.update(.05,g.elapsed+.05*i,g.dragon,()=>{});
    }
    if(g.missions.stage!==2)throw Error('Fase dos cristais não iniciou: '+g.missions.stage);
    for(let i=0;i<3;i++){
      g.dragon.group.position.copy(g.missions.crystals[i].position);
      g.missions.update(.05,g.elapsed+.4+.05*i,g.dragon,()=>{});
    }
    if(g.missions.stage!==3)throw Error('Fogo não foi desbloqueado: '+g.missions.stage);
    return {stage:g.missions.stage,crystals:g.missions.crystals.map(v=>!!v.userData.collected)};
  });
  assert.equal(rings.stage,3);

  const targets=await run('Três orbes destruídos com projéteis reais',()=>{
    const g=window.__brumariaQAGame;
    const shoot=target=>{
      const p=target.position;
      g.dragon.group.position.set(p.x,p.y,p.z+42);
      g.dragon.yaw=0;g.dragon.group.rotation.y=0;
      g.dragon.speed=0;g.dragon.fireCooldown=0;
      g.dragon.energy=g.progression.stats.maxEnergy;
      const before=g.projectiles.length;
      g.fire();
      if(g.projectiles.length<=before)throw Error('Fogo não criou projétil');
      for(let tick=0;tick<20;tick++)g.updateProjectiles(.05);
    };
    for(let i=0;i<3;i++){
      const target=g.missions.targets[i];
      shoot(target);
      if(!target.userData.destroyed)throw Error('Orbe '+i+' não foi destruído');
    }
    return {stage:g.missions.stage,targets:g.missions.targets.map(t=>!!t.userData.destroyed)};
  });
  assert.equal(targets.stage,4);

  const combat=await run('Três sentinelas derrotadas com tiros e colisão',()=>{
    const g=window.__brumariaQAGame;
    for(let i=0;i<3;i++){
      const enemy=g.enemies.enemies[i];
      for(let shot=0;shot<4&&enemy.alive;shot++){
        const p=enemy.position;
        g.dragon.group.position.set(p.x,p.y,p.z+42);
        g.dragon.yaw=0;g.dragon.group.rotation.y=0;
        g.dragon.speed=0;g.dragon.fireCooldown=0;
        g.dragon.energy=g.progression.stats.maxEnergy;
        g.fire();
        for(let tick=0;tick<20;tick++)g.updateProjectiles(.05);
      }
      if(enemy.alive)throw Error('Sentinela '+i+' não foi derrotada');
    }
    return {stage:g.missions.stage,dead:g.enemies.enemies.map(e=>!e.alive)};
  });
  assert.equal(combat.stage,5);
  await page.waitForTimeout(350);
  await page.screenshot({path:'artifacts/rescue-stage.png'});

  const pickup=await run('Primeiro filhote resgatado por aproximação lenta',()=>{
    const g=window.__brumariaQAGame,baby=g.missions.hatchlings[0];
    g.dragon.group.position.copy(baby.position);g.dragon.speed=8;
    for(let i=0;i<26;i++)g.missions.update(.05,g.elapsed+i*.05,g.dragon,()=>{});
    if(g.missions.carriedIndex!==0)throw Error('Filhote não foi recolhido');
    g.dragon.group.position.copy(g.missions.nest.position);g.dragon.speed=5;
    g.missions.update(.05,g.elapsed+2,g.dragon,()=>{});
    if(g.missions.progress!==1||!g.missions.hatchlings[0].userData.rescued)throw Error('Entrega não registrada');
    if(!g.saveGame())throw Error('Checkpoint não pode ser salvo');
    return g.missions.snapshot();
  });
  assert.equal(pickup.progress,1);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__brumariaQAGame,null,{timeout:45000});
  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  const reloaded=await run('Recuperação do save após o primeiro resgate',()=>{
    const g=window.__brumariaQAGame;
    const snapshot=g.missions.snapshot();
    if(snapshot.stage!==5||snapshot.progress!==1||!snapshot.hatchlings[0])
      throw Error('Save da missão não retomou: '+JSON.stringify(snapshot));
    return snapshot;
  });
  assert.equal(reloaded.progress,1);

  const endRescue=await run('Resgatar e entregar os outros dois filhotes',()=>{
    const g=window.__brumariaQAGame;
    if(!g.dragon.riding)g.dragon.mount();
    for(let index=1;index<=2;index++){
      const baby=g.missions.hatchlings[index];
      g.dragon.group.position.copy(baby.position);g.dragon.speed=7;
      for(let tick=0;tick<26;tick++)g.missions.update(.05,g.elapsed+index*4+tick*.05,g.dragon,()=>{});
      if(g.missions.carriedIndex!==index)throw Error('Filhote '+index+' não foi recolhido');
      g.dragon.group.position.copy(g.missions.nest.position);g.dragon.speed=5;
      g.missions.update(.05,g.elapsed+index*4+2,g.dragon,()=>{});
    }
    if(g.missions.stage!==6)throw Error('Resgate não terminou: '+g.missions.stage);
    if(!g.missions.hatchlings.every(b=>b.userData.rescued))throw Error('Filhote perdido');
    return g.missions.snapshot();
  });
  assert.equal(endRescue.stage,6);

  const pet=await run('Carinho repetível sem ganhar pontos duplicados',()=>{
    const g=window.__brumariaQAGame,creature=g.wildDragons.creatures.find(c=>c.spec.id==='nimbo');
    if(g.dragon.riding){g.dragon.dismount();g.hero.setMounted(false);}
    g.wildBonds.state.nimbo=3;
    g.hero.group.position.copy(creature.group.position);
    const proximity=g.wildDragons.nearby(g.hero.group.position,8.2,true);
    if(proximity!==creature)throw Error('Dragão amigo não foi encontrado');
    for(let i=0;i<50;i++)g.wildDragons.approach.update('nimbo',.05,g.elapsed+i*.05,
      {distance:2,speed:0,riding:false});
    const before=g.progression.points;
    if(!g.interactWildDragon())throw Error('Interação com amigo falhou');
    if(creature.petTime<=0)throw Error('Animação não iniciou');
    if(g.progression.points!==before)throw Error('Carinho repetiu recompensa');
    return {bond:g.wildBonds.progress('nimbo'),points:g.progression.points,petTime:creature.petTime};
  });
  assert.equal(pet.bond,3);
  await page.waitForTimeout(900);
  await check('Renderização e frame após combate, resgate e carinho');
  await page.screenshot({path:'artifacts/missions-final.png'});
  console.log('QA REAL CONCLUÍDO: sete etapas, capturas em artifacts/');
}catch(error){
  console.error('QA MISSIONS ERROR:',error);
  try{await page.screenshot({path:'artifacts/missions-failure.png',fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
