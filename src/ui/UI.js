import { ISLANDS, QUEST_DEFS } from '../world/config.js';
import {shouldThrottleHUD} from '../systems/PerformanceBudget.js';
import {headingToObjective,missionNextStep,shouldShowMountainHint} from '../systems/ObjectiveGuidance.js';
import {SPECIES,SKILLS} from '../systems/Progression.js';
import {CONTRACTS} from '../systems/VillageContracts.js';
import {CIRCUITS} from '../systems/Training.js';
import {LANDMARKS} from '../systems/Discovery.js';
import {WILD_DRAGON_DEFS} from '../systems/WildBonds.js';
export class UI {
  constructor(){
    this.mode=document.getElementById('mode-pill');this.fps=document.getElementById('fps-pill');
    this.questIndex=document.getElementById('quest-index');this.questTitle=document.getElementById('quest-title');
    this.questDesc=document.getElementById('quest-desc');this.questProgress=document.getElementById('quest-progress');this.questGuide=document.getElementById('quest-guide');
    this.energyNumber=document.getElementById('energy-number');this.energyBar=document.getElementById('energy-bar');
    this.speed=document.getElementById('speed-text');this.altitude=document.getElementById('altitude-text');this.dodgeStatus=document.getElementById('dodge-status');this.pulseStatus=document.getElementById('pulse-status');
    this.healthNumber=document.getElementById('health-number');this.healthBar=document.getElementById('health-bar');
    this.healthLabel=document.getElementById('health-label');
    this.hitOverlay=document.getElementById('hurt-overlay');this.targetLock=document.getElementById('target-lock');
    this.waypoint=document.getElementById('waypoint');this.toastElement=document.getElementById('toast');
    this.interaction=document.getElementById('interaction');this.mini=document.getElementById('mini-map');this.ctx=this.mini.getContext('2d');
    this.lastStage=-1;this.lastProgress=-1;this.toastTimer=null;this.uiClock=0;
    this.stable=document.getElementById('stable');this.trainingStatus=document.getElementById('training-status');
    this.contractStatus=document.getElementById('contract-status');
    this.weatherPill=document.getElementById('weather-pill');this.clockPill=document.getElementById('clock-pill');this.expeditionStatus=document.getElementById('expedition-status');
    this.dialogue=document.getElementById('npc-dialogue');this.dialogueOpen=false;
    document.getElementById('npc-close').addEventListener('click',()=>this.hideDialogue());
  }
  connectStable(game){
    document.getElementById('stable-toggle').addEventListener('click',()=>game.toggleStable());
    document.getElementById('stable-close').addEventListener('click',()=>game.toggleStable());
    document.getElementById('train-start').addEventListener('click',()=>game.startTraining());
    document.getElementById('train-advanced').addEventListener('click',()=>game.startTraining('advanced'));
    document.getElementById('train-frontier').addEventListener('click',()=>game.startTraining('frontier'));
    document.getElementById('stable-preview-motion').addEventListener('change',event=>{
      game.stablePreview?.setMotion(event.target.value);
    });
    const furyStatus=document.getElementById('fury-glb-status');
    for(const [species,buttonId,inputId] of [
      ['furia_noite','night-fury-glb-import','night-fury-glb-file'],
      ['furia_luz','light-fury-glb-import','light-fury-glb-file']
    ]){
      const button=document.getElementById(buttonId),input=document.getElementById(inputId);
      button.addEventListener('click',()=>input.click());
      input.addEventListener('change',async()=>{
        const file=input.files?.[0];input.value='';if(!file)return;
        button.disabled=true;furyStatus.dataset.state='neutral';
        furyStatus.textContent='Validando esqueleto e oito animações de '+SPECIES[species].name+'…';
        try{
          if(!file.name.toLowerCase().endsWith('.glb'))throw Error('Selecione o arquivo .glb, não o pacote .zip.');
          // Previewing the locked Fúria da Luz does not unlock or mount it.
          // It does, however, prove the GLB can render before caching it.
          if(game.stablePreview?.species!==species)game.stablePreview?.showSpecies(species);
          const result=await game.speciesModels.installUploaded(species,await file.arrayBuffer(),
            {previewDragon:game.stablePreview?.dragon});
          if(game.stablePreview?.species===species&&!result.previewed)
            await game.speciesModels.preview(game.stablePreview.dragon,species);
          furyStatus.dataset.state='ok';
          furyStatus.textContent=SPECIES[species].name+' carregada! '+result.info.animationCount+
            ' animações · '+(result.saved?'salva neste navegador.':'ativa nesta sessão (armazenamento indisponível).')+
            (species==='furia_luz'&&!game.progression.unlocked.includes(species)?
              ' Desbloqueie a Fúria da Luz com 4 pontos para montá-la.':'');
        }catch(error){
          furyStatus.dataset.state='error';
          furyStatus.textContent='Falha no GLB: '+String(error?.message??error);
        }finally{button.disabled=false;}
      });
    }
    document.getElementById('species-list').addEventListener('click',event=>{
      const preview=event.target.closest('[data-preview]');
      if(preview){
        game.stablePreview?.showSpecies(preview.dataset.preview);
        if(game.stablePreview)void game.speciesModels.preview(game.stablePreview.dragon,preview.dataset.preview);
        return;
      }
      const btn=event.target.closest('[data-species]');if(btn)game.chooseSpecies(btn.dataset.species);
    });
    document.getElementById('skill-list').addEventListener('click',event=>{
      const btn=event.target.closest('[data-skill]');if(btn)game.buySkill(btn.dataset.skill);
    });
  }
  renderStable(game){
    const p=game.progression,atVillage=game.nearStable();
    document.getElementById('daily-day').textContent=`DIA ${game.dayNight.state.day}`;
    const board=document.getElementById('daily-board');board.replaceChildren();
    for(const [key,def] of Object.entries(CONTRACTS)){
      const state=game.contracts.state[key];
      const row=document.createElement('div');row.className='daily-job';
      const title=document.createElement('strong');title.textContent=def.title;
      const status=document.createElement('span');status.textContent=state.status==='done'?'✓ CONCLUÍDO · AMANHÃ':state.status==='ready'?'VOLTE AO MORADOR':state.status==='active'?`${state.collected.filter(Boolean).length}/3 · EM ANDAMENTO`:`FALE COM ${def.npc.toUpperCase()} · +${def.reward} PT`;
      row.append(title,status);board.append(row);
    }
    document.getElementById('train-points').textContent=p.points;
    document.getElementById('discovery-list').textContent=`Marcos encontrados: ${game.discovery.total}/${LANDMARKS.length} · Dragões selvagens: ${game.wildBonds.total}/3. Cada amizade rende +1 ponto.`;
    document.getElementById('frontier-list').textContent='FRONTEIRA · '+game.frontier.summary();
    document.getElementById('train-circuits').textContent=p.circuits+' circuitos';
    const wildList=document.getElementById('wild-list');wildList.replaceChildren();
    for(const creature of WILD_DRAGON_DEFS){
      const level=game.wildBonds.progress(creature.id);
      const line=document.createElement('div');line.className='wild-entry';
      const label=document.createElement('strong');label.textContent=`✦ ${creature.name} · ${creature.island}`;
      const status=document.createElement('small');
      status.textContent=level===3?'AMIZADE CONQUISTADA':`Confiança ${level}/3 · ${creature.temperament} · pouse, aproxime-se e espere ele relaxar${creature.id==='nimbo'?' (SHIFT para andar devagar)':''}`;
      line.append(label,status);wildList.append(line);
    }
    const note=document.getElementById('stable-village-note');
    note.textContent=atVillage?'Você está na vila. Treinamento disponível.':'Fora da vila: viaje ao Refúgio, pouse e aproxime-se do estábulo para treinar ou trocar de dragão.';
    note.classList.toggle('warning',!atVillage);
    const species=document.getElementById('species-list');species.replaceChildren();
    for(const [id,spec] of Object.entries(SPECIES)){
      const unlocked=p.unlocked.includes(id),active=p.species===id;
      const card=document.createElement('div');card.className='species-card'+(active?' selected':'');
      const swatch=document.createElement('div');swatch.className='species-swatch';swatch.style.background=`linear-gradient(130deg,#${spec.colors[1].toString(16).padStart(6,'0')},#${spec.colors[4].toString(16).padStart(6,'0')})`;
      const info=document.createElement('div');info.className='species-info';
      const title=document.createElement('strong');title.textContent=spec.name+' · '+spec.kind;
      const desc=document.createElement('small');desc.textContent=spec.description;
      info.append(title,desc);
      const btn=document.createElement('button');btn.type='button';btn.dataset.species=id;
      btn.textContent=active?'ATUAL':unlocked?'ESCOLHER':`LIBERAR · ${spec.price} PT`;
      btn.disabled=active||!atVillage||( !unlocked&&p.points<spec.price);
      const inspect=document.createElement('button');inspect.type='button';inspect.className='preview-button';inspect.dataset.preview=id;inspect.textContent='VER EM 3D';
      card.append(swatch,info,inspect,btn);species.append(card);
    }
    const skills=document.getElementById('skill-list');skills.replaceChildren();
    for(const [id,skill] of Object.entries(SKILLS)){
      const level=p.skills[id],row=document.createElement('div');row.className='skill-row';
      const name=document.createElement('strong');name.textContent=skill.name;
      const lvl=document.createElement('span');lvl.className='skill-level';lvl.textContent=`NÍVEL ${level}/${skill.max}`;
      const btn=document.createElement('button');btn.type='button';btn.dataset.skill=id;btn.textContent=level>=skill.max?'MÁXIMO':`EVOLUIR · ${level+1} PT`;
      btn.disabled=!atVillage||level>=skill.max||p.points<level+1;
      row.append(name,lvl,btn);skills.append(row);
    }
    const start=document.getElementById('train-start');start.disabled=!atVillage||game.training.active||game.training.cooldown>0;
    start.textContent=game.training.cooldown>0?`RECARGA ${Math.ceil(game.training.cooldown)}s`:'INICIAR CIRCUITO';
    const advanced=document.getElementById('train-advanced');
    advanced.disabled=!atVillage||game.training.active||game.training.cooldown>0||p.circuits<1;
    advanced.textContent=p.circuits<1?'DESBLOQUEIA APÓS 1 TREINO':game.training.cooldown>0?`RECARGA ${Math.ceil(game.training.cooldown)}s`:'CIRCUITO AVANÇADO';
    const frontier=document.getElementById('train-frontier');
    frontier.disabled=!atVillage||game.training.active||game.training.cooldown>0||p.circuits<2;
    frontier.textContent=p.circuits<2?'DESBLOQUEIA APÓS 2 TREINOS':game.training.cooldown>0?`RECARGA ${Math.ceil(game.training.cooldown)}s`:'TRAVESSIA DAS SETE ILHAS';
  }
  showDialogue(name,role,text){
    document.getElementById('npc-name').textContent=name;
    document.getElementById('npc-role').textContent=role;
    document.getElementById('npc-text').textContent=text;
    this.dialogue.classList.remove('hidden');this.dialogueOpen=true;
  }
  hideDialogue(){this.dialogue.classList.add('hidden');this.dialogueOpen=false;}
  toast(text,secs=3){this.toastElement.textContent=text;this.toastElement.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toastElement.classList.remove('visible'),secs*1000);}
  updateQuest(missions){
    const rescueHint=missions.rescueDescription?.()??'';
    const rescueStep=missions.stage===5?`${missions.carriedIndex}:${Math.floor(missions.rescueHold*4)}`:'';
    if(this.lastStage===missions.stage && this.lastProgress===missions.progress && this.lastRescueStep===rescueStep)return;
    this.lastRescueStep=rescueStep;
    this.lastStage=missions.stage;this.lastProgress=missions.progress;
    const q=missions.quest;
    this.questIndex.textContent=missions.complete?'✓ COMPLETA':`${String(missions.stage+1).padStart(2,'0')} / ${String(QUEST_DEFS.length).padStart(2,'0')}`;
    this.questTitle.textContent=q?.title??'GUARDIÃO DOS CÉUS';
    this.questDesc.textContent=rescueHint||q?.desc||'Todas as missões concluídas. Continue explorando Brumária!';
    this.questProgress.replaceChildren();
    const total=q?.total??1,progress=missions.complete?total:missions.progress;
    for(let i=0;i<total;i++){const el=document.createElement('div');el.className='quest-tick'+(i<progress?' done':'');this.questProgress.append(el);}
  }
  update(dt,game){
    this.uiClock+=dt;if(shouldThrottleHUD(this.uiClock,game.graphics?.tier??'balanced'))return;this.uiClock=0;
    const {dragon,hero,missions,world}=game;
    this.updateQuest(missions);
    if(game.inMountain){
      const exp=game.expedition;
      this.questIndex.textContent='EXPEDIÇÃO · MONTANHAS';
      this.questTitle.textContent=exp.phase==='boats'?'FROTA DOS SAQUEADORES':exp.phase==='boss'?'O DRAGÃO COLOSSAL':'REGRESSO AO REFÚGIO';
      this.questDesc.textContent=exp.phase==='boats'?`Destrua os 3 barcos inimigos com fogo · ${exp.boatsSunk}/3 afundados (2 acertos por barco).`:
        exp.phase==='boss'?`Enfrente o dragão gigante · resistência ${exp.bossHealth}/12 · desvie das bolas de fogo.`:
        'Retorne pelo portal a oeste para completar a expedição e receber +3 pontos.';
      this.questProgress.replaceChildren();
      const total=exp.phase==='boss'?12:3,done=exp.phase==='boats'?exp.boatsSunk:exp.phase==='boss'?12-exp.bossHealth:3;
      for(let i=0;i<total;i++){const dot=document.createElement('div');dot.className='quest-tick'+(i<done?' done':'');this.questProgress.append(dot);}
    }else if(this.lastMountain){this.lastStage=-1;this.updateQuest(missions);}
    this.lastMountain=game.inMountain;
    this.weatherPill.textContent=game.weather.mode.label+(dragon.riding&&dragon.airborne&&dragon.windDrift>.1?` · RAJADAS ${dragon.windDrift.toFixed(1)}m/s`:``);
    this.clockPill.textContent=`DIA ${game.dayNight.state.day} · ${game.dayNight.clock}`;
    this.expeditionStatus.textContent=`MARCOS ${game.discovery.total}/${LANDMARKS.length} · AMIZADES ${game.wildBonds.total}/3`;
    const phase=dragon.pose==='takeoff'?'DECOLAGEM':dragon.pose==='landing'?'POUSO':dragon.airborne?'VOO LIVRE':'MONTADO';
    this.mode.textContent=dragon.riding?`${phase} · ${SPECIES[game.progression.species].name.toUpperCase()}`:'EXPLORAÇÃO';
    const energyPct=100*dragon.energy/(game.progression.stats.maxEnergy);
    this.energyNumber.textContent=`${Math.ceil(dragon.energy)} / ${game.progression.stats.maxEnergy}`;this.energyBar.style.width=energyPct+'%';
    this.healthLabel.textContent='RESISTÊNCIA DE '+SPECIES[game.progression.species].name.toUpperCase();
    this.healthNumber.textContent=Math.ceil(game.health)+'%';this.healthBar.style.width=game.health+'%';
    this.hitOverlay.style.opacity=String(Math.min(.66,game.hitFlash*1.25));
    this.speed.textContent=dragon.riding?`VELOCIDADE ${Math.round(dragon.speed*3.6)} km/h`:game.input.isDown('shift')?'A PÉ · PASSOS LEVES':'A PÉ';
    this.dodgeStatus.textContent=dragon.dodgeRemaining>0?'✦ ESQUIVANDO':dragon.dodgeCooldown>0?`ESQUIVA ${dragon.dodgeCooldown.toFixed(1)}s`:dragon.riding&&dragon.airborne?'ESQUIVA Q · PRONTA':'ESQUIVA · EM VOO';
    if(this.pulseStatus)this.pulseStatus.textContent=game.pulseCooldown>0?`H · PODER ${game.pulseCooldown.toFixed(1)}s`:'H · PODER PRONTO';
    const ground=Math.max(-.9,world.heightAt(dragon.group.position.x,dragon.group.position.z));
    this.altitude.textContent=`ALT ${Math.max(0,Math.round(dragon.group.position.y-ground))} m`;
    const position=dragon.riding?dragon.group.position:hero.group.position;
    const activeContract=game.contracts.active[0];
    const contractKey=activeContract?.[0];
    const contract=contractKey?CONTRACTS[contractKey]:null;
    const state=activeContract?.[1];
    const marker=contractKey&&state.status==='active'?game.villagers.markers.find(m=>m.id===contractKey&&!state.collected[m.index]):null;
    const npcReturn=contractKey&&state.status==='ready'?game.villagers.npcs.find(n=>n.spec.id===contract.npc):null;
    const contractTarget=marker?.group.position??npcReturn?.root.position??null;
    const mountainTarget=game.inMountain&&game.mountain?(game.expedition.phase==='boats'?
      game.mountain.boats.find((boat,i)=>game.expedition.boatHealth[i]>0)?.position:
      game.expedition.phase==='boss'?game.mountain.boss.position:{x:753,y:50,z:35}):null;
    // Optional local targets only take navigation priority while flying
    // near that frontier island, never during story expeditions or training.
    const frontierTarget=!game.inMountain&&!game.training.active&&!contractTarget
      ?game.frontier.objective(position,missions.stage>=3):null;
    const target=mountainTarget??game.training.waypoint??contractTarget??frontierTarget??missions.waypoint(dragon);
    const bearing=headingToObjective(position,target,dragon.riding?dragon.yaw:hero.group.rotation.y);
    const enemyForGuide=!game.inMountain&&missions.stage===4?game.enemies.nearest(dragon.group.position):null;
    this.questGuide.textContent=missionNextStep({stage:missions.stage,progress:missions.progress,riding:dragon.riding,
      carriedIndex:missions.carriedIndex,rescueHold:missions.rescueHold,
      nearestEnemyHealth:enemyForGuide?.health,inMountain:game.inMountain,expeditionPhase:game.expedition.phase,
      bossHealth:game.expedition.bossHealth,activeContract:contractTarget,activeContractType:contractKey,training:game.training.active});
    if(frontierTarget)this.questGuide.textContent=frontierTarget.kind==='relic'
      ?`FRONTEIRA · ${frontierTarget.label} · ${frontierTarget.remaining} pendente(s) · atravesse em voo.`
      :`FRONTEIRA · ${frontierTarget.label} · pressione F para lançar fogo e use Q para esquivar.`;
    const waypointType=game.inMountain?'EXPEDIÇÃO':game.training.active?'TREINO':contractTarget?'CONTRATO':frontierTarget?'FRONTEIRA':'OBJETIVO';
    this.waypoint.textContent=bearing?`${bearing.symbol} ${waypointType} · ${bearing.distance} m · ${bearing.direction}`:
      missions.complete?'ARQUIPÉLAGO LIBERADO':missions.stage===6?'VOLTE À VILA · TECLA T':'ENCONTRE O PRÓXIMO OBJETIVO';
    const portal=document.getElementById('mountain-status');
    portal.classList.toggle('hidden',!game.inMountain && !shouldShowMountainHint(position,missions.stage,false,game.expedition.phase==='complete'));

    this.contractStatus.classList.toggle('hidden',!activeContract);
    if(activeContract)this.contractStatus.textContent=`${contract.title} · ${state.collected.filter(Boolean).length}/${contract.points.length}${state.status==='ready'?' · VOLTE AO NPC':contract.requiresFire?' · USE FOGO':''}`;
    this.trainingStatus.classList.toggle('hidden',!game.training.active);
    if(game.training.active)this.trainingStatus.textContent=`TREINO ${CIRCUITS[game.training.mode].label} · ${game.training.progress}/${game.training.definition.checkpoints.length} · ${Math.ceil(game.training.seconds)}s`;
    const campaignEnemy=!game.inMountain&&missions.stage===4?game.enemies.nearest(dragon.group.position):null;
    const nearGuardians=game.inMountain?[]:game.frontier.activeGuardians;
    const frontierEnemy=nearGuardians.reduce((best,e)=>!best||
      e.position.distanceToSquared(dragon.group.position)<best.position.distanceToSquared(dragon.group.position)?e:best,null);
    const enemy=campaignEnemy&&frontierEnemy
      ?(campaignEnemy.position.distanceToSquared(dragon.group.position)
        <frontierEnemy.position.distanceToSquared(dragon.group.position)?campaignEnemy:frontierEnemy)
      :campaignEnemy??frontierEnemy;
    const toEnemy=enemy?enemy.position.clone().sub(dragon.group.position):null;
    const locked=dragon.riding&&toEnemy&&toEnemy.length()<165&&dragon.forward().dot(toEnemy.normalize())>.78;
    this.targetLock.classList.toggle('hidden',!locked);
    if(locked)this.targetLock.textContent=`◆ ${enemy===frontierEnemy?'GUARDIÃO':'SENTINELA'} NA MIRA · ${Math.ceil(enemy.health)}/${enemy.maxHealth}`;
    const near=hero.group.position.distanceTo(dragon.group.position)<10.5;
    const nearNpc=!dragon.riding?game.villagers.nearby(hero.group.position,5.5):null;
    const nearWild=!dragon.riding&&!nearNpc?game.wildDragons.nearby(hero.group.position,8.2,true):null;
    const showInteraction=nearNpc||nearWild|| (dragon.riding?(dragon.group.position.y-world.heightAt(dragon.group.position.x,dragon.group.position.z)<4.8 && dragon.speed<11):near);
    this.interaction.classList.toggle('hidden',!showInteraction);
    const calm=nearWild?game.wildDragons.approach.get(nearWild.spec.id):null;
    const wildBefriended=!!nearWild&&game.wildBonds.progress(nearWild.spec.id)>=3;
    this.interaction.textContent=nearNpc?`E · CONVERSAR COM ${nearNpc.spec.name}`:nearWild?(calm.mood==='assustado'?`${nearWild.spec.name} ASSUSTADO · PARE E AGUARDE`:calm.mood==='tranquilo'?(wildBefriended?`E · ACARICIAR ${nearWild.spec.name} · AMIGO`:`E · CARINHO EM ${nearWild.spec.name} (${game.wildBonds.progress(nearWild.spec.id)}/3)`): `GANHANDO CONFIANÇA ${Math.round(calm.calm*100)}% · ${nearWild.spec.id==='nimbo'?'SHIFT = ANDAR DEVAGAR':'FIQUE POR PERTO'}`):dragon.riding?'E · DESMONTAR':`E · MONTAR EM ${SPECIES[game.progression.species].name.toUpperCase()}`;
    const mobileInteract=document.querySelector('[data-tap="e"]');
    if(mobileInteract)mobileInteract.textContent=nearNpc?'FALAR':nearWild?(calm.mood==='tranquilo'?'CARINHO':'ESPERAR'):dragon.riding?'DESCER':'MONTAR';
    const slowButton=document.querySelector('[data-hold="shift"]');
    if(slowButton)slowButton.textContent=dragon.riding?'TURBO':'DEVAGAR';
    this.drawMap(position,target,dragon.yaw,missions,game.enemies,game.villagers,game.contracts,game.discovery,game.wildDragons,game.mountain,game.expedition,game.frontier);
  }
  drawMap(position,target,yaw,missions,enemies,villagers,contracts,discovery,wildDragons,mountain=null,expedition=null,frontier=null){
    const ctx=this.ctx,W=this.mini.width,H=this.mini.height;
    // Keep the distant objective inside the radar when island separation grows.
    const objectiveRange=target?Math.hypot(target.x-position.x,target.z-position.z):0;
    const s=objectiveRange>250?Math.max(.15,Math.min(.30,(Math.min(W,H)*.43)/objectiveRange)):.30;
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#0b3645';ctx.fillRect(0,0,W,H);
    const mx=x=>W/2+(x-position.x)*s, my=z=>H/2+(z-position.z)*s;
    ctx.fillStyle='#4e8d76';ctx.strokeStyle='#8bc19c';ctx.lineWidth=1;
    if(position.x>650){ctx.beginPath();ctx.arc(mx(1042),my(3),176*s,0,Math.PI*2);ctx.fill();ctx.stroke();}
    else for(const island of ISLANDS){ctx.beginPath();ctx.arc(mx(island.x),my(island.z),island.r*s,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.strokeStyle='rgba(232,250,255,.13)';ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
    if(position.x>650&&mountain){
      ctx.fillStyle='#ffb5a6';mountain.boats.forEach((boat,i)=>{if(expedition?.boatHealth[i]<=0)return;ctx.fillRect(mx(boat.position.x)-4,my(boat.position.z)-2,8,4);});
      if(expedition?.phase==='boss'){ctx.fillStyle='#ff618f';ctx.beginPath();ctx.arc(mx(mountain.boss.position.x),my(mountain.boss.position.z),7,0,Math.PI*2);ctx.fill();}
    }
    if(position.x<650){ctx.fillStyle='#82eeff';ctx.fillRect(Math.min(W-8,mx(328))-4,my(35)-4,8,8);}
    if(position.x<650&&missions.stage===4){ctx.fillStyle='#f68bab';for(const e of enemies.alive){ctx.beginPath();ctx.arc(mx(e.position.x),my(e.position.z),3.5,0,Math.PI*2);ctx.fill();}}
    if(position.x<650&&missions.stage===5){ctx.fillStyle='#a0ffd2';for(const baby of missions.hatchlings.filter((b,i)=>!b.userData.rescued&&i!==missions.carriedIndex)){ctx.beginPath();ctx.arc(mx(baby.position.x),my(baby.position.z),3.1,0,Math.PI*2);ctx.fill();}}
    if(position.x<650&&missions.stage===5&&missions.carriedIndex>=0){const refuge=missions.nest.position;ctx.strokeStyle='#ffe38b';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(mx(refuge.x),my(refuge.z),6,0,Math.PI*2);ctx.stroke();}
    if(position.x<650)for(let i=0;i<LANDMARKS.length;i++){ 
      if(discovery.found[i])continue;
      const lm=LANDMARKS[i];const x=mx(lm.x),y=my(lm.z);
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#9df8e3';ctx.fillRect(-2.8,-2.8,5.6,5.6);ctx.restore();
    }
    if(position.x<650)for(const wild of wildDragons.remaining){
      const x=mx(wild.group.position.x),y=my(wild.group.position.z);
      ctx.fillStyle='#f4aeff';ctx.strokeStyle='#50235f';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    if(position.x<650)for(const npc of villagers.npcs){ctx.fillStyle='#ffcf82';ctx.fillRect(mx(npc.root.position.x)-2,my(npc.root.position.z)-2,4,4);}
    if(position.x<650)for(const m of villagers.markers){if(!m.group.visible)continue;ctx.fillStyle=m.id==='correio'?'#f3c88a':'#89ffc3';ctx.beginPath();ctx.arc(mx(m.group.position.x),my(m.group.position.z),3,0,Math.PI*2);ctx.fill();}
    // Remaining fragments stay visible on the radar even when the story
    // objective is elsewhere. Drawn by Canvas2D, never a GPU draw call.
    if(position.x<650&&frontier){
      for(const record of frontier.markers.values()){
        const c=record.zone.id==='crystal'?'#83f3ff':'#ffae7b';
        for(const point of record.points){
          if(frontier.found.has(point.id))continue;
          const x=mx(point.x),y=my(point.z);
          if(x<0||x>W||y<0||y>H)continue;
          ctx.strokeStyle=c;ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);
          ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.stroke();
        }
      }
      for(const guard of frontier.activeGuardians){
        const x=mx(guard.position.x),y=my(guard.position.z);
        if(x<0||x>W||y<0||y>H)continue;
        ctx.strokeStyle='#ff748b';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();
      }
    }
    if(target){const tx=mx(target.x),ty=my(target.z);ctx.save();ctx.shadowColor='#ffdb8d';ctx.shadowBlur=14;ctx.fillStyle='#ffe3a0';ctx.beginPath();ctx.arc(tx,ty,5,0,Math.PI*2);ctx.fill();ctx.restore();}
    ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-yaw);ctx.fillStyle='#f3fff8';ctx.strokeStyle='#133944';ctx.lineWidth=1.8;
    ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(-5,7);ctx.lineTo(0,4);ctx.lineTo(5,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    ctx.strokeStyle='rgba(255,255,255,.21)';ctx.strokeRect(.5,.5,W-1,H-1);
  }
  setFPS(fps){this.fps.textContent=fps+' FPS';}
}
