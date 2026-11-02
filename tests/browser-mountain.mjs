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
page.on('pageerror',e=>errors.push(String(e?.stack??e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
// QA-only access, injected into a Playwright response. Production files never
// expose internal game objects or cheat shortcuts.
await page.route('**/src/main.js',async route=>{
  const r=await route.fetch(),s=await r.text(),needle='    new Game();';
  if(!s.includes(needle))throw Error('Main boot entry not found');
  await route.fulfill({response:r,body:s.replace(needle,'    window.__brumariaQAGame=new Game();')});
});
async function run(label,fn){
  const value=await page.evaluate(fn);
  if(await page.locator('#fatal').isVisible())throw Error(label+': '+(await page.locator('#fatal').innerText()).slice(0,1500));
  if(errors.length)throw Error(label+': '+errors.join('\n').slice(0,1500));
  console.log('PASS:',label,JSON.stringify(value));return value;
}
try{
  await page.goto(process.env.BRUMARIA_TEST_URL??'http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:50000});
  await page.waitForFunction(()=>!!window.__brumariaQAGame,null,{timeout:45000});
  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  await page.waitForFunction(()=>window.__brumariaQAGame?.started===true);

  const training=await run('Treino básico, avanço de missão, desafio avançado e cooldown',()=>{
    const g=window.__brumariaQAGame;
    g.missions.stage=6;g.missions.progress=0;g.missions.refreshVisible();
    if(!g.dragon.riding){g.dragon.mount();g.hero.setMounted(true);}
    g.dragon.airborne=false;
    g.dragon.speed=0;
    g.dragon.group.position.set(8,g.world.groundHeightAt(8,7)+2.58,7);
    const initial=g.progression.points,prev=g.progression.circuits;
    g.startTraining('basic');
    if(!g.training.active)throw Error('Treino básico não iniciou');
    for(const spot of g.training.definition.checkpoints){
      g.dragon.group.position.set(...spot);
      g.training.update(.05,g.elapsed,g.dragon);
    }
    if(g.training.active||g.missions.stage!==7)throw Error('Treino básico não completou missão final');
    if(g.progression.circuits!==prev+1||g.progression.points!==initial+3)throw Error('Recompensa básica errada');
    g.dragon.group.position.set(8,g.world.groundHeightAt(8,7)+2.58,7);
    g.dragon.airborne=false;
    g.startTraining('advanced');
    if(g.training.active)throw Error('Cooldown permitiu repetir treino imediatamente');
    g.training.update(26,g.elapsed,g.dragon);
    g.startTraining('advanced');
    if(!g.training.active)throw Error('Treino avançado bloqueado indevidamente');
    const first=g.training.definition.checkpoints[0];
    g.dragon.group.position.set(...first);
    g.dragon.speed=9;
    g.training.update(.05,g.elapsed,g.dragon);
    if(g.training.progress!==0)throw Error('Aro avançado aceitou velocidade baixa');
    g.dragon.speed=22;
    for(const spot of g.training.definition.checkpoints){
      g.dragon.group.position.set(...spot);
      g.training.update(.05,g.elapsed,g.dragon);
    }
    if(g.training.active||g.progression.circuits!==prev+2||g.progression.points!==initial+5)
      throw Error('Treino avançado não concluiu corretamente');
    g.training.update(40,g.elapsed,g.dragon);
    if(g.progression.points!==initial+5)throw Error('Recompensa duplicada');
    return {stage:g.missions.stage,circuits:g.progression.circuits,earned:g.progression.points-initial};
  });
  assert.equal(training.stage,7);

  const gate=await run('Portal monta região sob demanda, entra sem limpar progresso',async()=>{
    const g=window.__brumariaQAGame;
    g.dragon.airborne=true;
    g.dragon.group.position.set(515,50,-192.5);
    const obstaclesBefore=g.world.obstacles.length;
    await g.loadMountain();
    if(!g.mountain||!g.world.mountainRegion)throw Error('Carregamento dinâmico não criou MountainRegion');
    const added=g.world.obstacles.length-obstaclesBefore;
    if(added<3)throw Error('Região não tem colisões');
    g.dragon.group.position.set(632,44,-192.5);
    g.updateExpedition(.05);
    if(!g.inMountain||!g.expedition.inRegion)throw Error('Portal não moveu para nova região');
    return {inMountain:g.inMountain,x:g.dragon.group.position.x,added};
  });
  assert.equal(gate.inMountain,true);
  await page.waitForTimeout(300);
  await page.screenshot({path:'artifacts/mountain-entry.png'});

  const ships=await run('Combate verdadeiro: afundar 3 barcos com dois tiros cada',()=>{
    const g=window.__brumariaQAGame;
    const shoot=target=>{
      const p=target.position;
      g.dragon.group.position.set(p.x,p.y,p.z+66);
      g.dragon.yaw=0;g.dragon.group.rotation.y=0;
      g.dragon.speed=0;g.dragon.fireCooldown=0;
      g.dragon.energy=g.progression.stats.maxEnergy;
      g.dragon.group.updateMatrixWorld(true);
      const before=g.projectiles.length;
      g.fire();
      if(g.projectiles.length<=before)throw Error('Disparo não gerado');
      for(let i=0;i<22;i++)g.updateProjectiles(.05);
      g.clearProjectiles();
    };
    for(let boatIndex=0;boatIndex<3;boatIndex++){
      const ship=g.mountain.boats[boatIndex];
      shoot(ship);
      if(g.expedition.boatHealth[boatIndex]!==1)throw Error('Primeiro acerto no barco '+boatIndex+' falhou');
      shoot(ship);
      if(g.expedition.boatHealth[boatIndex]!==0)throw Error('Barco '+boatIndex+' não afundou');
    }
    if(g.expedition.phase!=='boss'||g.expedition.boatsSunk!==3)throw Error('Chefe não foi liberado');
    return {boats:g.expedition.boatHealth,phase:g.expedition.phase,visible:g.mountain.boss.visible};
  });
  assert.equal(ships.phase,'boss');
  await page.waitForTimeout(400);
  await page.screenshot({path:'artifacts/mountain-boss.png'});

  const attack=await run('Chefe anuncia ataque antes de disparar',()=>{
    const g=window.__brumariaQAGame,b=g.mountain.boss;
    g.dragon.group.position.copy(b.position).add({x:0,y:0,z:95});
    g.dragon.airborne=true;g.dragon.speed=0;
    let warned=false,fired=false;
    const atStart=g.bossAttackCount;
    for(let i=0;i<112;i++){
      g.updateExpedition(.05);
      if(g.bossAttackState.warned)warned=true;
      if(g.bossAttackCount>atStart){fired=true;break;}
    }
    if(!warned||!fired)throw Error('Chefe não anunciou e disparou no intervalo previsto');
    if(g.bossCounterTime<=0)throw Error('Janela de contra-ataque ausente');
    g.clearProjectiles();
    return {warned,fired,pattern:g.bossAttackCount,counter:g.bossCounterTime};
  });
  assert.equal(attack.fired,true);

  const checkpoint=await run('Salvar montanha com barcos concluídos e chefe ativo',()=>{
    const g=window.__brumariaQAGame;
    g.dragon.group.position.set(940,54,43);g.dragon.airborne=true;
    if(!g.saveGame())throw Error('Falha ao salvar progresso da montanha');
    return {phase:g.expedition.phase,boatHealth:[...g.expedition.boatHealth],boss:g.expedition.bossHealth};
  });
  assert.equal(checkpoint.phase,'boss');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__brumariaQAGame,null,{timeout:45000});
  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  const restore=await run('Restaurar campanha da montanha ao recarregar',async()=>{
    const g=window.__brumariaQAGame;
    if(g.expedition.phase!=='boss'||g.expedition.boatsSunk!==3)throw Error('Save perdeu barcos e chefe');
    if(g.dragon.group.position.x>650)throw Error('Save distante não voltou ao portal');
    await g.loadMountain();
    g.dragon.airborne=true;
    g.dragon.group.position.set(632,44,-192.5);
    g.updateExpedition(.05);
    if(!g.inMountain||g.expedition.phase!=='boss')throw Error('Retorno à montanha falhou');
    return {phase:g.expedition.phase,boats:g.expedition.boatsSunk,entry:g.dragon.group.position.x};
  });
  assert.equal(restore.phase,'boss');

  const boss=await run('Derrotar chefe com projéteis e contra-ataque',()=>{
    const g=window.__brumariaQAGame;
    let shots=0;
    while(g.expedition.bossHealth>0&&shots<14){
      const p=g.mountain.boss.position;
      g.dragon.group.position.set(p.x,p.y,p.z+69);
      g.dragon.yaw=0;g.dragon.group.rotation.y=0;
      g.dragon.speed=0;g.dragon.airborne=true;
      g.dragon.fireCooldown=0;
      g.dragon.energy=g.progression.stats.maxEnergy;
      g.dragon.group.updateMatrixWorld(true);
      if(shots===0)g.bossCounterTime=1.0;
      g.fire();
      for(let i=0;i<22;i++)g.updateProjectiles(.05);
      g.clearProjectiles();shots++;
    }
    if(g.expedition.phase!=='return'||g.expedition.bossHealth!==0)
      throw Error('Chefe não derrotado: '+JSON.stringify(g.expedition.snapshot()));
    return {shots,health:g.expedition.bossHealth,phase:g.expedition.phase};
  });
  assert.equal(boss.phase,'return');

  const returnTrip=await run('Voltar pelo portal e receber recompensa uma única vez',()=>{
    const g=window.__brumariaQAGame,base=g.progression.points;
    g.dragon.group.position.set(712,55,35);g.dragon.airborne=true;
    g.updateExpedition(.05);
    if(g.inMountain||g.expedition.phase!=='complete'||g.progression.points!==base+3)
      throw Error('Expedição não finalizou ou premiação inválida');
    g.updateExpedition(.05);
    if(g.progression.points!==base+3)throw Error('Prêmio da expedição duplicado');
    const success={phase:g.expedition.phase,added:g.progression.points-base,unloaded:g.mountain===null};
    if(!g.saveGame())throw Error('Conquista não foi salva');
    return success;
  });
  assert.equal(returnTrip.unloaded,true);

  await page.waitForTimeout(900);
  if(errors.length)throw Error('Erros do browser: '+errors.join('\n'));
  if(await page.locator('#fatal').isVisible())throw Error('Jogo exibiu erro fatal');
  await page.screenshot({path:'artifacts/mountain-complete.png'});
  console.log('QA TREINO E MONTANHA CONCLUÍDO: viagem, navios, chefe, saves e recompensa');
}catch(error){
  console.error('QA TREINO MONTANHA ERROR:',error);
  try{await page.screenshot({path:'artifacts/mountain-failure.png',fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
