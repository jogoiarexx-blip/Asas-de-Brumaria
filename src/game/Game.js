import * as THREE from 'three';
import { Input } from './Input.js';
import {CameraOrbit,cameraOffset} from './CameraOrbit.js';
import {dragonCameraFraming} from './dragonCameraFraming.js';
import {resolveCameraPosition} from '../utils/spatialSweep.js';
import {safeDismountSpot} from '../utils/surfaces.js';
import {recoverFreePosition,obstacleBlocks} from '../utils/collision.js';
import { World } from '../world/World.js';
import {ISLANDS} from '../world/config.js';
import { Dragon } from '../entities/Dragon.js';
import { EnemySquad } from '../entities/EnemyDragon.js';
import {FrontierActivities} from '../systems/FrontierActivities.js';
import { Hero } from '../entities/Hero.js';
import {HeroAssetUI} from '../ui/HeroAssetUI.js';
import {DragonAssetUI} from '../ui/DragonAssetUI.js';
import {SpeciesDragonModels} from '../entities/SpeciesDragonModels.js';
import {browserDragonBudget,preferMobileDragonAssets} from '../entities/dragonTextureBudget.js';
import { Missions } from '../systems/Missions.js';
import { AudioSystem } from '../systems/Audio.js';
import { Effects } from '../systems/Effects.js';
import {segmentSphereHit} from '../systems/combatMath.js';
import { UI } from '../ui/UI.js';
import {Progression,SPECIES,REWARDS} from '../systems/Progression.js';
import {SaveSystem} from '../systems/SaveSystem.js';
import {Training,CIRCUITS} from '../systems/Training.js';
import {VillageContracts,CONTRACTS} from '../systems/VillageContracts.js';
import {VillageNPCs} from '../entities/VillageNPCs.js';
import { smoothFollow } from '../utils/math.js';
import {Weather} from '../systems/Weather.js';
import {Discovery,LANDMARKS} from '../systems/Discovery.js';
import {Landmarks} from '../world/Landmarks.js';
import {DayNight} from '../systems/DayNight.js';
import {StablePreview} from '../ui/StablePreview.js';
import {GraphicsQuality} from '../systems/GraphicsQuality.js';
import {GraphicsBenchmark,formatBenchmark} from '../systems/GraphicsBenchmark.js';
import {performanceSnapshot,shouldSkipRendering} from '../systems/PerformanceDiagnostics.js';
import {sceneActorStats} from '../systems/ActorLOD.js';
import {projectileLimit} from '../systems/PerformanceBudget.js';
import {projectileAdmission} from '../systems/ProjectilePolicy.js';
import {WildBonds} from '../systems/WildBonds.js';
import {WildDragons} from '../entities/WildDragons.js';
import {ExpeditionProgress,MOUNTAIN_PORTAL,MOUNTAIN_ENTRY,shouldLoadMountain,shouldEnterMountain,shouldExitMountain,shouldHoldMountainGate} from '../systems/ExpeditionRules.js';
import {readGPUSettings,writeGPUSettings,chooseContextOptions,describeRenderer} from '../systems/GPUSettings.js';
import {bossAttackStep,bossAttackPattern,bossShotDirections,bossPatternLabel} from '../systems/MountainCombat.js';
import {contactBurstSize} from '../entities/FlightContact.js';
import {bossAimPoint} from '../systems/AerialCombat.js';
import {counterOpportunity,counterStrike} from '../systems/BossCounter.js';

export class Game {
  constructor() {
    this.container=document.getElementById('game');
    this.gpuPrefs=readGPUSettings();
    const weakGpu=(navigator.deviceMemory>0&&navigator.deviceMemory<=4)||matchMedia('(pointer:coarse)').matches;
    try{if(!localStorage.getItem('brumaria-gpu-options-v1'))this.gpuPrefs.antialias=!weakGpu;}catch{}
    const deviceOptions=chooseContextOptions(this.gpuPrefs);
    this.renderer=new THREE.WebGLRenderer({antialias:deviceOptions.antialias,powerPreference:deviceOptions.powerPreference});
    // GraphicsQuality applies a device-aware resolution cap immediately below.
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.23;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);
    this.webglLost=false;this.frameError=null;this.lastKnownFPS=0;this.diagnosticsVisible=false;this.actorStats={visible:0,full:0,limited:0,hidden:0};this.actorViewDirection=new THREE.Vector3();
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x9bdbef);this.scene.fog=new THREE.FogExp2(0xa3e2ed,.00165);
    this.camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.15,1600);
    this.input=new Input();this.audio=new AudioSystem();this.ui=new UI();
    this.cameraOrbit=new CameraOrbit();this.bindOrbitControls();this.controllerWasConnected=false;
    this.graphics=new GraphicsQuality(this.renderer,window.devicePixelRatio||1,matchMedia('(pointer:coarse)').matches,navigator.deviceMemory??0);
    this.graphics.resolutionScale=this.gpuPrefs.resolution;this.graphics.shadowsAllowed=this.gpuPrefs.shadows;this.graphics.apply();
    this.initGPUOptions();this.updateGraphicsLabel();
    this.saveSystem=new SaveSystem();this.savedData=this.saveSystem.read();
    this.expedition=new ExpeditionProgress(this.savedData?.expedition);this.mountain=null;this.mountainLoading=null;this.inMountain=false;this.bossAttackState={elapsed:0,warned:false};this.bossAttackCount=0;this.bossWarnedPattern=null;this.bossCounterTime=0;this._bossVolleyVector=new THREE.Vector3();this._bossShotDirection=new THREE.Vector3();this._bossPredicted=new THREE.Vector3();this._groundContactPosition=new THREE.Vector3();this.gateLoadingWarned=false;this.gateWarned=false;this.mountainRetryUntil=0;
    this.portal=this.makeMountainPortal();
    this.progression=new Progression(this.savedData?.progression);this.autoSaveTime=0;this.lastSaveOk=null;
    this.world=new World(this.scene);
    this.weather=new Weather(this.scene,this.world,this.camera,this.savedData?.weather);
    this.dayNight=new DayNight(this.scene,this.world,this.savedData?.dayNight);
    this.discovery=new Discovery(this.savedData?.discoveries);
    this.wildBonds=new WildBonds(this.savedData?.wildBonds);
    this.landmarks=new Landmarks(this.scene,this.world);
    this.dragon=new Dragon(this.scene,this.world);
    this.hero=new Hero(this.scene,this.world,this.dragon);
    this.heroAssetUI=new HeroAssetUI(this.hero);
    this.dragonAssetUI=new DragonAssetUI(this.dragon);
    this.speciesModels=new SpeciesDragonModels(this.dragon,{
      preferMobile:preferMobileDragonAssets(browserDragonBudget()),
      onStatus:status=>{
        const el=document.getElementById('dragon-model-status');
        if(!el)return;
        el.dataset.state=status.state;
        el.textContent=status.message;
        if(status.state==='error')console.warn('[Fúrias GLB]',status.message);
        if(status.state==='error'&&this.started)this.ui.toast(status.message,8);
      }
    });
    this.dragonAssetUI.onReset=()=>this.speciesModels.select(this.progression.species);
    this.enemies=new EnemySquad(this.scene,this.world);
    this.frontier=new FrontierActivities(this.scene,this.world,this.savedData?.frontier);
    this.effects=new Effects(this.scene);
    this.applySceneQuality();
    this.contracts=new VillageContracts(this.savedData?.contracts,this.dayNight.state.day);
    this.villagers=new VillageNPCs(this.scene,this.world);
    this.wildDragons=new WildDragons(this.scene,this.world,this.wildBonds);
    this.villagers.refresh(this.contracts);
    this.missions=new Missions(this.scene,this.audio,()=>{if(this.missions)this.ui.updateQuest(this.missions);},this.enemies,
      stage=>{this.progression.grant(REWARDS[stage]??1);this.saveGame();this.ui.toast(`Missão concluída! +${REWARDS[stage]??1} ponto(s) de treino.`,4);});
    this.missions.onCheckpoint=()=>this.saveGame();
    // Position the refuge beacon just above the actual terrain surface.
    this.missions.nest.position.y=this.world.groundHeightAt(0,0,1.65)+3.2;
    this.training=new Training(this.scene,()=>{},(mode,reward)=>{
      this.progression.grant(reward);this.progression.circuits++;
      if(mode==='basic')this.missions.trainingCompleted();
      this.saveGame();this.ui.renderStable(this);
    });
    this.dragon.setSpecies(this.progression.species,SPECIES[this.progression.species]);
    this.dragon.setStats(this.progression.stats);
    this.dragonModelReady=this.speciesModels.select(this.progression.species);
    this.ui.connectStable(this);
    this.stablePreview=null;
    if(this.savedData){document.getElementById('start-btn').firstChild.textContent='CONTINUAR AVENTURA ';document.getElementById('new-game-btn').classList.remove('hidden');}
    document.getElementById('new-game-btn').addEventListener('click',()=>this.newGame());
    this.projectiles=[];this.projectilePool=[];this._projectileFrom=new THREE.Vector3();this._projectileTo=new THREE.Vector3();this._fireStart=new THREE.Vector3();this._aimBest=new THREE.Vector3();this.clock=new THREE.Clock();this.started=false;this.elapsed=0;this.fpsTime=0;this.frames=0;
    this.health=100;this.maxHealth=100;this.hurtImmunity=0;this.hitFlash=0;this.needsProjectileClear=false;
    if(this.savedData)this.restoreSave(this.savedData);
    this.projectileGeometry=new THREE.IcosahedronGeometry(.9,1);
    this.projectileMaterials={player:new THREE.MeshBasicMaterial({color:0xffb65a}),enemy:new THREE.MeshBasicMaterial({color:0xf06ca9})};
    // Pre-warm the maximum draw budget using shared geometry/materials.
    // All record/mesh allocations happen while loading, not during rapid fire.
    for(let i=0;i<projectileLimit('quality');i++){
      this.projectilePool.push({mesh:new THREE.Mesh(this.projectileGeometry,this.projectileMaterials.player),
        velocity:new THREE.Vector3(),life:0,owner:'player'});
    }
    this.camera.position.set(6,24,38);this.camera.lookAt(0,12,0);
    window.addEventListener('resize',()=>this.onResize());
    document.getElementById('quality-toggle').addEventListener('click',()=>this.cycleGraphics());
    this.benchmark=new GraphicsBenchmark();this.benchmarkPrevious=null;
    this.benchmarkReport='Pressione B ou o botão COMPARAR FPS para medir os três modos nesta máquina.';
    document.getElementById('benchmark-toggle').addEventListener('click',()=>this.toggleBenchmark());
    document.getElementById('benchmark-copy').addEventListener('click',()=>this.copyBenchmarkReport());
    window.addEventListener('pagehide',()=>this.saveGame());
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.cancelBenchmark('Teste interrompido: aba em segundo plano.');this.saveGame();}
    });
    document.getElementById('start-btn').addEventListener('click',()=>this.start());
    this.ui.updateQuest(this.missions);this.updateExpeditionUI();
    this.renderer.domElement.addEventListener('webglcontextlost',event=>{
      event.preventDefault();this.webglLost=true;this.cancelBenchmark('Teste interrompido: contexto WebGL perdido.');
      this.ui.toast('GPU reiniciada: aguardando restaurar gráficos…',5);
    });
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{
      this.webglLost=false;
      // Reconfigure buffers and shadows after a driver/browser GPU restart.
      this.graphics.tier='economy';this.graphics.apply();this.applySceneQuality();this.updateGraphicsLabel();
      this.ui.toast('Gráficos restaurados no modo LEVE. O progresso foi preservado.',6);
    });
    this.renderer.setAnimationLoop(()=>{
      try{if(!this.frameError)this.frame();}
      catch(error){this.handleFrameFailure(error);}
    });
  }
  handleFrameFailure(error){
    if(this.frameError)return;
    this.frameError=error;this.cancelBenchmark('Teste interrompido após erro do jogo.');
    console.error('Erro na atualização do jogo:',error);
    try{this.saveGame();}catch{}
    // Keep the error visible instead of a frozen frame without explanation.
    const fatal=document.getElementById('fatal');
    fatal.classList.remove('hidden');
    fatal.replaceChildren();
    const title=document.createElement('h2');title.textContent='O jogo encontrou um erro';fatal.append(title);
    const message=document.createElement('p');message.textContent='Seu progresso foi salvo quando possível. Recarregue a página para tentar continuar.';fatal.append(message);
    const details=document.createElement('pre');details.textContent=String(error?.stack??error);fatal.append(details);
    const retry=document.createElement('button');retry.textContent='Recarregar jogo';
    retry.addEventListener('click',()=>window.location.reload());fatal.append(retry);
  }
  toggleDiagnostics(){
    this.diagnosticsVisible=!this.diagnosticsVisible;
    document.getElementById('performance-panel')?.classList.toggle('hidden',!this.diagnosticsVisible);
    document.getElementById('benchmark-controls')?.classList.toggle('hidden',!this.diagnosticsVisible);
  }
  showBenchmarkReport(){
    const el=document.getElementById('benchmark-report');
    el.textContent=this.benchmarkReport;
    document.getElementById('benchmark-toggle').textContent=this.benchmark.active?'CANCELAR TESTE (B)':'COMPARAR FPS (B)';
    document.getElementById('benchmark-copy').disabled=!this.benchmark.results.length;
  }
  setBenchmarkTier(tier){
    this.graphics.tier=tier;this.graphics.apply();this.applySceneQuality();this.updateGraphicsLabel();
  }
  restoreBenchmarkGraphics(){
    if(!this.benchmarkPrevious)return;
    // Benchmark never alters the persisted graphics mode or user save.
    this.setBenchmarkTier(this.benchmarkPrevious.tier);
    this.graphics.slowSamples=this.benchmarkPrevious.slowSamples;
    this.graphics.fastSamples=this.benchmarkPrevious.fastSamples;
    this.graphics.cooldown=Math.max(10,this.benchmarkPrevious.cooldown);
    this.benchmarkPrevious=null;
  }
  cancelBenchmark(message='Teste de desempenho cancelado.'){
    if(!this.benchmark.active)return;
    this.benchmark.cancel();this.restoreBenchmarkGraphics();
    this.benchmarkReport=message;this.showBenchmarkReport();
  }
  toggleBenchmark(){
    if(this.benchmark.active){this.cancelBenchmark();return;}
    if(!this.started||!this.ui.stable.classList.contains('hidden')){
      this.ui.toast('Inicie o jogo e feche o estábulo para comparar o desempenho.');return;
    }
    this.benchmarkPrevious={tier:this.graphics.tier,slowSamples:this.graphics.slowSamples,
      fastSamples:this.graphics.fastSamples,cooldown:this.graphics.cooldown};
    this.benchmarkReport='Iniciando comparação real no mesmo cenário. Fique parado e mantenha a câmera fixa.';
    this.setBenchmarkTier(this.benchmark.start());
    if(!this.diagnosticsVisible)this.toggleDiagnostics();
    this.showBenchmarkReport();
  }
  updateBenchmark(dt){
    if(!this.benchmark.active)return;
    const event=this.benchmark.recordFrame(dt,this.renderer.info?.render);
    this._benchmarkUIClock=(this._benchmarkUIClock??0)+Math.min(dt,.1);
    // Don't redraw benchmark DOM every frame; it would bias the measurement.
    if(!event&&this._benchmarkUIClock<.25)return;
    this._benchmarkUIClock=0;
    if(event?.type==='next')this.setBenchmarkTier(event.tier);
    if(event?.type==='complete'){
      this.restoreBenchmarkGraphics();
      this.benchmarkReport=formatBenchmark(event.results);
      this.ui.toast('Comparação concluída! Resultados no painel F3.',5);
    }else if(this.benchmark.active){
      this.benchmarkReport=`Teste em andamento: ${this.benchmark.progress()}\nPerfil anterior: ${this.benchmark.results.length}/3 concluídos.\nNão mova a câmera para comparar a mesma cena.`;
    }
    this.showBenchmarkReport();
  }
  async copyBenchmarkReport(){
    if(!this.benchmark.results.length)return;
    try{await navigator.clipboard.writeText(formatBenchmark(this.benchmark.results));
      this.ui.toast('Resultados de desempenho copiados para compartilhar.',3);
    }catch{this.ui.toast('Não foi possível copiar; fotografe o painel F3.',3);}
  }
  renderDiagnostics(fps){
    if(!this.diagnosticsVisible)return;
    let active=0;
    for(const bucket of Object.values(this.effects.buckets))active+=bucket.particles.length;
    document.getElementById('performance-panel').textContent=performanceSnapshot({
      fps,renderer:this.renderer,projectiles:this.projectiles.length,effects:active,
      tier:this.graphics.tier,mounted:this.dragon.riding,
      visibleIslands:this.world.visibleIslandCount,totalIslands:ISLANDS.length,
      actorsVisible:this.actorStats.visible,actorsLimited:this.actorStats.limited,
      actorsProxied:this.actorStats.proxied??0});
  }
  updateActorDetail(){
    const observer=this.dragon.riding?this.dragon.group.position:this.hero.group.position;
    const camera=this.camera.position;
    const forward=this.camera.getWorldDirection(this.actorViewDirection);
    const tier=this.graphics.tier;
    this.wildDragons.setDetail(observer,tier,camera,forward);
    this.enemies.setDetail(observer,tier,camera,forward);
    this.frontier.setDetail(observer,tier,camera,forward);
    this.villagers.setDetail(observer,tier,camera,forward);
    const levels=[...this.wildDragons.creatures.map(c=>c.visualLevel),
      ...this.enemies.enemies.filter(e=>e.active&&e.alive).map(e=>e.visualLevel),
      ...this.frontier.activeGuardians.map(e=>e.visualLevel),
      ...this.villagers.npcs.map(n=>n.root.visible?'full':'hidden')];
    this.actorStats=sceneActorStats(levels);
    this.actorStats.proxied=this.wildDragons.creatures.filter(c=>c.lowDetail.visible&&c.group.visible).length+
      this.enemies.enemies.filter(e=>e.proxy.visible&&e.group.visible).length+
      this.frontier.activeGuardians.filter(e=>e.proxy.visible&&e.group.visible).length;
  }
  bindOrbitControls(){
    // Orbit only on the canvas: HUD buttons and the stable panel remain clickable.
    const canvas=this.renderer.domElement;
    let pointerId=null,lastX=0,lastY=0;
    canvas.style.touchAction='none';
    canvas.addEventListener('pointerdown',event=>{
      if(!this.started||event.button!==0||!this.ui.stable.classList.contains('hidden'))return;
      pointerId=event.pointerId;lastX=event.clientX;lastY=event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove',event=>{
      if(pointerId!==event.pointerId||!this.started)return;
      this.cameraOrbit.drag(event.clientX-lastX,event.clientY-lastY);
      lastX=event.clientX;lastY=event.clientY;
    });
    const release=event=>{if(pointerId===event.pointerId)pointerId=null;};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,release);
    canvas.addEventListener('wheel',event=>{
      if(!this.started)return;
      event.preventDefault();this.cameraOrbit.zoomBy(event.deltaY);
    },{passive:false});
  }
  start(){
    this.started=true;document.getElementById('start-screen').classList.add('hidden');
    this.audio.unlock();this.ui.toast(this.savedData?'Progresso recuperado! Aperte T para acessar o estábulo.':'Encontre sua Fúria da Noite. Pressione E para montar!',5);
    this.input.clearActions();
  }
  newGame(){
    if(!window.confirm('Apagar o progresso salvo e iniciar uma nova aventura?'))return;
    this.saveSystem.clear();window.location.reload();
  }
  nearStable(){
    const p=this.dragon.riding?this.dragon.group.position:this.hero.group.position;
    return Math.hypot(p.x,p.z)<65 && (!this.dragon.riding||!this.dragon.airborne);
  }
  toggleStable(){
    const open=this.ui.stable.classList.contains('hidden');
    if(open&&this.benchmark.active)this.cancelBenchmark('Teste cancelado ao abrir o estábulo.');
    this.ui.stable.classList.toggle('hidden',!open);
    if(open){this.ui.renderStable(this);
      try{this.stablePreview??=new StablePreview(document.getElementById('stable-preview-canvas'));
        this.stablePreview.showSpecies(this.progression.species);
        this.stablePreview.setMotion(document.getElementById('stable-preview-motion').value);
        void this.speciesModels.preview(this.stablePreview.dragon,this.progression.species);
      }catch(error){console.warn('Prévia 3D indisponível:',error);document.getElementById('stable-preview-caption').textContent='A prévia 3D não está disponível neste dispositivo.';}
      this.input.down.clear();this.input.clearActions();
      document.getElementById('stable-close')?.focus();}
  }
  buySkill(id){
    if(!this.nearStable()){this.ui.toast('Para treinar, volte ao estábulo da vila.');return;}
    const result=this.progression.upgrade(id);
    if(result.ok){this.dragon.setStats(this.progression.stats);this.audio.play('complete');this.saveGame();}
    this.ui.toast(result.ok?'Habilidade melhorada!':result.reason);
    this.ui.renderStable(this);
  }
  chooseSpecies(id){
    if(!this.nearStable()){this.ui.toast('Troque de dragão somente no estábulo da vila.');return;}
    if(this.progression.species===id)return;
    if(!this.progression.unlocked.includes(id)){
      const result=this.progression.unlock(id);
      if(!result.ok){this.ui.toast(result.reason);return;}
    }
    this.progression.select(id);this.dragon.setSpecies(id,SPECIES[id]);this.dragon.setStats(this.progression.stats);
    void this.speciesModels.select(id);
    this.stablePreview?.showSpecies(id);
    if(this.stablePreview)void this.speciesModels.preview(this.stablePreview.dragon,id);
    this.saveGame();this.audio.play('mount');this.ui.toast(`${SPECIES[id].name} é agora seu companheiro!`,4);this.ui.renderStable(this);
  }
  startTraining(mode='basic'){
    if(mode==='advanced'&&this.progression.circuits<1){this.ui.toast('Conclua primeiro o Desafio dos Ventos.');return;}
    if(mode==='frontier'&&this.progression.circuits<2){this.ui.toast('Complete dois circuitos antes da Travessia das Sete Ilhas.');return;}
    if(!this.nearStable()){this.ui.toast('Para começar o circuito, retorne à vila e pouse.');return;}
    const result=this.training.start(mode);
    if(result.ok){this.ui.stable.classList.add('hidden');this.ui.toast(`${CIRCUITS[mode].label}: atravesse ${CIRCUITS[mode].checkpoints.length} aros em ${CIRCUITS[mode].seconds} segundos!`,6);this.saveGame();}
    else this.ui.toast(result.reason);
  }
  saveGame(manual=false){
    if(!this.started&&!manual)return false;
    const p=this.dragon.group.position,h=this.hero._dismountMotion?.end??this.hero.group.position;
    const payload={version:1,savedAt:new Date().toISOString(),mission:this.missions.snapshot(),progression:this.progression.snapshot(),
      frontier:this.frontier.snapshot(),
      contracts:this.contracts.snapshot(),weather:this.weather.snapshot(),dayNight:this.dayNight.snapshot(),discoveries:this.discovery.snapshot(),
      wildBonds:this.wildBonds.snapshot(),expedition:this.expedition.snapshot(),
      player:{x:p.x,y:p.y,z:p.z,yaw:this.dragon.yaw,health:this.health,energy:this.dragon.energy,mounted:this.dragon.riding,airborne:this.dragon.airborne,heroX:h.x,heroZ:h.z}};
    this.lastSaveOk=this.saveSystem.write(payload);
    if(manual)this.ui.toast(this.lastSaveOk?'Partida salva neste navegador.':'Não foi possível salvar: armazenamento indisponível.');
    return this.lastSaveOk;
  }
  restoreSave(data){
    this.missions.restore(data.mission);
    this.frontier.restore(data.frontier);
    this.contracts.restore(data.contracts);this.contracts.syncDay(this.dayNight.state.day);this.villagers.refresh(this.contracts);
    const p={...data.player};
    // If the game was closed during a streamed map, restore at its gateway.
    // Side-mission progress is preserved, even if the mountain module is not yet loaded.
    if(p.x>650){p.x=310;p.z=35;p.y=Math.max(40,p.y);p.airborne=true;p.mounted=true;p.heroX=300;p.heroZ=35;}
    this.expedition.inRegion=false;
    const dragonY=Math.max(p.y,this.world.groundHeightAt(p.x,p.z,1.65)+2.58);
    const dragonSpot=recoverFreePosition({x:p.x,z:p.z},1.65,this.world.obstacles,
      (x,z)=>p.airborne||this.world.walkable(x,z),
      o=>obstacleBlocks(o,dragonY,1.65),
      {groundAt:(x,z)=>this.world.groundHeightAt(x,z,1.65),maxHeightDelta:p.airborne?Infinity:2.2});
    const dragonX=dragonSpot?.x??p.x,dragonZ=dragonSpot?.z??p.z;
    this.dragon.group.position.set(dragonX,Math.max(p.y,this.world.groundHeightAt(dragonX,dragonZ,1.65)+2.58),dragonZ);
    this.dragon.yaw=p.yaw;this.dragon.group.rotation.y=p.yaw;
    this.dragon.airborne=p.mounted&&p.airborne;this.dragon.energy=Math.min(this.progression.stats.maxEnergy,p.energy);
    const safeHero=recoverFreePosition({x:p.heroX,z:p.heroZ},.52,this.world.obstacles,
      (x,z)=>this.world.walkable(x,z),o=>obstacleBlocks(o,this.world.groundHeightAt(p.heroX,p.heroZ,.52)+1.1,1.1),
      {groundAt:(x,z)=>this.world.groundHeightAt(x,z,.52)});
    const heroX=safeHero?.x??p.heroX,heroZ=safeHero?.z??p.heroZ;
    this.hero.group.position.set(heroX,this.world.groundHeightAt(heroX,heroZ,.52),heroZ);
    if(p.mounted){this.dragon.mount();this.hero.setMounted(true,{animate:false});}
    this.health=p.health;
  }
  applySceneQuality(){
    const tier=this.graphics.tier;
    this.effects?.setQuality(tier);this.weather?.setQuality(tier);this.world?.setDetailQuality(tier);
    if(this.world?.sun){this.world.sun.castShadow=tier!=='economy'&&this.graphics.shadowsAllowed;}
    if(this.world?.fireLight)this.world.fireLight.visible=tier!=='economy';
    if(this.dragon?.accentLight)this.dragon.accentLight.visible=tier==='quality';
    // Shadows are fully disabled in economy. Never change map size on each shot.
  }
  updateGraphicsLabel(){document.getElementById('quality-toggle').textContent=`GRÁFICOS: ${this.graphics.label} · G`;}
  cycleGraphics(){
    if(this.benchmark.active)this.cancelBenchmark('Teste interrompido: modo gráfico alterado.');
    this.graphics.cycle();this.applySceneQuality();this.updateGraphicsLabel();this.ui.toast(`Qualidade: ${this.graphics.label}`,3);
  }
  initGPUOptions(){
    const panel=document.getElementById('gpu-panel');
    document.getElementById('gpu-toggle').addEventListener('click',()=>panel.classList.toggle('hidden'));
    document.getElementById('gpu-close').addEventListener('click',()=>panel.classList.add('hidden'));
    document.getElementById('gpu-preference').value=this.gpuPrefs.preference;
    document.getElementById('gpu-resolution').value=String(this.gpuPrefs.resolution);
    document.getElementById('gpu-shadows').checked=this.gpuPrefs.shadows;
    document.getElementById('gpu-antialias').checked=this.gpuPrefs.antialias;
    document.getElementById('gpu-device').textContent=describeRenderer(this.renderer.getContext());
    document.getElementById('gpu-apply').addEventListener('click',()=>{
      const next={preference:document.getElementById('gpu-preference').value,
        resolution:Number(document.getElementById('gpu-resolution').value),
        shadows:document.getElementById('gpu-shadows').checked,
        antialias:document.getElementById('gpu-antialias').checked};
      if(!writeGPUSettings(next)){
        document.getElementById('gpu-note').textContent='O navegador bloqueou as preferências. Libere armazenamento local.';return;
      }
      this.saveGame();window.location.reload();
    });
  }
  makeMountainPortal(){
    const root=new THREE.Group();root.position.set(MOUNTAIN_PORTAL.x,44,MOUNTAIN_PORTAL.z);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(12,.7,8,40),new THREE.MeshBasicMaterial({color:0x8deef0}));
    ring.rotation.y=Math.PI/2;root.add(ring);
    const signal=new THREE.Mesh(new THREE.ConeGeometry(4,16,6),new THREE.MeshBasicMaterial({color:0xbacbff,transparent:true,opacity:.5,depthWrite:false}));signal.position.y=14;root.add(signal);
    this.scene.add(root);return root;
  }
  async loadMountain(){
    if(this.mountain||this.mountainLoading||this.elapsed<this.mountainRetryUntil)return this.mountainLoading;
    this.mountainLoading=(async()=>{
      const {MountainRegion}=await import('../world/MountainRegion.js');
      const chunk=new MountainRegion(this.scene,this.world,this.expedition);
      this.world.mountainRegion=chunk;this.mountain=chunk;
      this.ui.toast('Montanhas da Sombra carregadas. Siga em frente para entrar!',5);
    })().catch(error=>{
      this.mountainRetryUntil=this.elapsed+12;
      console.warn('Falha ao carregar mapa das montanhas:',error);
      this.ui.toast('Não foi possível carregar o mapa. Verifique a conexão e tente novamente.',6);
    }).finally(()=>{this.mountainLoading=null;});
    return this.mountainLoading;
  }
  unloadMountain(){
    if(!this.mountain||this.inMountain)return;
    this.mountain.setBossWarning(false);this.mountain.unload();this.mountain=null;
  }
  updateExpedition(dt){
    if(!this.started)return;
    const pos=this.dragon.group.position,riding=this.dragon.riding;
    this.portal.visible=!this.inMountain;
    if(!this.inMountain){
      if(shouldLoadMountain(pos,riding)){
        if(this.missions.stage<3){
          if(!this.gateWarned){this.ui.toast('Conclua as runas para liberar fogo antes de entrar nas montanhas!',4);this.gateWarned=true;}
        }else{this.gateWarned=false;this.loadMountain();}
      }else this.gateWarned=false;
      // Stream gate: do not let fast travel outrun the dynamic import.
      if(shouldHoldMountainGate(pos,riding,this.missions.stage>=3,!!this.mountain)){
        pos.x=MOUNTAIN_PORTAL.enterAt-2;
        this.dragon.speed=Math.min(this.dragon.speed,6);
        if(!this.gateLoadingWarned){
          this.ui.toast('Carregando Montanhas da Sombra… Aguarde junto ao portal.',4);
          this.gateLoadingWarned=true;
        }
      }else this.gateLoadingWarned=false;
      if(this.mountain&&shouldEnterMountain(pos,riding)&&this.missions.stage>=3){
        this.inMountain=true;this.expedition.inRegion=true;
        this.dragon.group.position.set(MOUNTAIN_ENTRY.x,Math.max(47,pos.y),MOUNTAIN_ENTRY.z);
        this.dragon.airborne=true;this.dragon.speed=Math.max(15,this.dragon.speed);
        this._camTarget?.copy(this.dragon.group.position);
        this.ui.toast('NOVA REGIÃO: MONTANHAS DA SOMBRA! Destrua os barcos inimigos.',6);this.saveGame();
      }
      // Keep the dynamically imported chunk cached near the gateway, then free its GPU resources.
      if(this.mountain&&pos.x<245)this.unloadMountain();
    }else if(shouldExitMountain(pos,riding)){
      this.inMountain=false;this.expedition.inRegion=false;
      this.dragon.group.position.set(295,Math.max(45,pos.y),35);
      this._camTarget?.copy(this.dragon.group.position);
      if(this.expedition.completeReturn()){
        this.progression.grant(3);this.audio.play('complete');
        this.ui.toast('EXPEDIÇÃO CONCLUÍDA! Montanhas libertadas · +3 pontos de treino!',7);
      }else this.ui.toast('De volta a Brumária! A missão das montanhas está salva.',4);
      this.saveGame();this.unloadMountain();
    }
    if(this.mountain){
      // refresh() is called only when progression changes; no repeated scene
      // writes on every frame while exploring the streaming region.
      this.mountain.update(dt,this.elapsed,this.dragon.group.position);
    }
    this.bossCounterTime=Math.max(0,this.bossCounterTime-dt);
    const boss=this.mountain?.boss;
    const bossDistance=boss?boss.position.distanceTo(this.dragon.group.position):Infinity;
    const active=this.inMountain&&this.expedition.phase==='boss'&&riding&&bossDistance>19&&bossDistance<230;
    const attack=bossAttackStep(this.bossAttackState,dt,{active,health:this.expedition.bossHealth});
    this.bossAttackState=attack.state;
    const plannedPattern=bossAttackPattern(this.bossAttackCount,this.expedition.bossHealth);
    if(attack.warn)this.bossWarnedPattern=plannedPattern;
    if(!active){this.bossWarnedPattern=null;this.bossCounterTime=0;}
    // If the boss loses enough health during an active tell, don't change the
    // projectile pattern after the player already chose an evasive route.
    const attackPattern=this.bossWarnedPattern??plannedPattern;
    this.mountain?.setBossWarning(attack.charging,attackPattern);
    if(attack.warn)this.ui.toast('⚠ '+bossPatternLabel(attackPattern),2.6);
    if(attack.fire&&boss){
      const ahead=bossAimPoint(boss.position,this.dragon.group.position,this.dragon.forward(),this.dragon.speed);
      const direction=this._bossShotDirection.copy(this._bossPredicted.set(ahead.x,ahead.y,ahead.z)).sub(boss.position).normalize();
      // Up to 3 pooled bullets; no new point lights, geometry or materials.
      for(const aim of bossShotDirections(direction,attackPattern)){
        this._bossVolleyVector.set(aim.x,aim.y,aim.z);
        this.spawnProjectile(boss.position,this._bossVolleyVector,'enemy');
      }
      this.effects.burst(boss.position,'enemy',8);
      this.bossCounterTime=counterOpportunity({volleyFired:true,health:this.expedition.bossHealth});
      this.bossAttackCount++;this.bossWarnedPattern=null;
    }
    this.updateExpeditionUI();
  }
  updateExpeditionUI(){
    const el=document.getElementById('mountain-status');
    if(this.inMountain){
      const p=this.expedition;
      el.textContent=p.phase==='boats'?`🏔 MONTANHAS · DESTRUIR BARCOS ${p.boatsSunk}/3`:
        p.phase==='boss'?`🐉 DRAGÃO GIGANTE · VIDA ${p.bossHealth}/12${this.bossAttackState.warned?' · ⚠ SOPRO IMINENTE!':this.bossCounterTime>0?' · ✦ CONTRA-ATAQUE!':''}`:
        p.phase==='return'?'✅ CHEFE DERROTADO · RETORNE PELO PORTAL A OESTE':
        '🏔 EXPEDIÇÃO CONCLUÍDA';
    }else el.textContent=this.expedition.phase==='complete'?'🏆 MONTANHAS LIBERTADAS':
      this.missions.stage>=3?'🏔 NOVO MAPA A LESTE · VOE AO PORTAL AZUL':'🏔 MAPA A LESTE · DESBLOQUEIE O FOGO';
  }
  onResize(){
    this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);
    this.graphics.onResize(window.devicePixelRatio||1);
  }
  interactVillager(){
    if(this.dragon.riding)return false;
    const npc=this.villagers.nearby(this.hero.group.position,5.5);
    if(!npc)return false;
    const result=this.contracts.talk(npc.spec.id);
    if(!result)return false;
    if(result.action==='reward'){
      this.progression.grant(result.reward);
      if(result.key==='ervas')this.health=Math.min(100,this.health+40);
      this.audio.play('complete');
    }
    if(result.action==='accepted'||result.action==='reward'){
      this.villagers.refresh(this.contracts);this.saveGame();
    }
    this.ui.showDialogue(npc.spec.name,npc.spec.role,result.text);
    this.ui.renderStable(this);
    return true;
  }
  interactWildDragon(){
    if(this.dragon.riding)return false;
    const creature=this.wildDragons.nearby(this.hero.group.position,8.2,true);
    if(!creature)return false;
    const distance=this.hero.group.position.distanceTo(creature.group.position);
    const ready=this.wildDragons.approach.ready(creature.spec.id,distance);
    if(!ready){
      const mood=this.wildDragons.approach.get(creature.spec.id);
      this.ui.toast(mood.mood==='assustado'?`${creature.spec.name} se assustou! Espere e aproxime-se devagar com SHIFT.`:`Fique perto de ${creature.spec.name} até ganhar confiança${creature.spec.id==='nimbo'?' (segure SHIFT para andar devagar)':''}.`,4);
      return true;
    }
    // Fully befriended dragons stay pettable, but never grant points again.
    if(this.wildBonds.progress(creature.spec.id)>=3){
      const pet=this.wildDragons.onPetted(creature.spec.id,this.elapsed);
      if(pet){
        this.effects.burst(creature.group.position.clone().add(new THREE.Vector3(0,2.5,0)),'rescue',6);
        this.audio.play('pickup');
        this.ui.toast(`${creature.spec.name} adora seu carinho! Amizade já conquistada.`,3);
      }else this.ui.toast(`${creature.spec.name} está descansando. Espere um instante para outro carinho.`,3);
      return true;
    }
    const result=this.wildBonds.bond(creature.spec.id,this.elapsed,ready);
    if(!result.ok){this.ui.toast(result.reason,3);return true;}
    this.wildDragons.approach.onBond(creature.spec.id);
    this.wildDragons.onPetted(creature.spec.id,this.elapsed);
    this.effects.burst(creature.group.position.clone().add(new THREE.Vector3(0,2.5,0)),'rescue',12);
    this.audio.play(result.completed?'complete':'pickup');
    if(result.completed){
      const newlyUnlocked=this.progression.discover(creature.spec.species);
      this.progression.grant(1);
      this.ui.toast(`${creature.spec.name} confia em você! ${newlyUnlocked?'Espécie liberada no estábulo. ':''}+1 ponto de treino · ${this.wildBonds.total}/3`,6);
      this.ui.renderStable(this);
    }else this.ui.toast(`${creature.spec.name}: confiança ${result.progress}/3 · aguarde um instante para novo carinho.`,4);
    this.saveGame();
    return true;
  }
  updateContracts(){
    const position=this.dragon.riding?this.dragon.group.position:this.hero.group.position;
    for(const [key,def] of Object.entries(CONTRACTS)){
      if(this.contracts.state[key].status!=='active'||this.dragon.riding!==def.requiresMount)continue;
      for(let i=0;i<def.points.length;i++){
        if(this.contracts.state[key].collected[i])continue;
        const marker=this.villagers.markers.find(m=>m.id===key&&m.index===i);
        if(marker&&position.distanceTo(marker.group.position)<(def.requiresMount?10:3.7)&&this.contracts.collect(key,i,this.dragon.riding)){
          this.audio.play('pickup');this.effects.burst(marker.group.position,'fire',9);
          this.villagers.refresh(this.contracts);
          const state=this.contracts.state[key];
          const done=state.collected.filter(Boolean).length;
          this.ui.toast(state.status==='ready'?`Objetivos completos! Retorne para ${this.villagers.npcs.find(n=>n.spec.id===def.npc)?.spec.name??def.npc} receber sua recompensa.`:`${def.title}: ${done}/${def.points.length}`,4);
          this.saveGame();break;
        }
      }
    }
  }
  mountOrDismount(){
    // Repeated E during the 3D transfer used to cancel/restart the animation,
    // displace the rider and save a position halfway between saddle and ground.
    if(this.hero._mountMotion||this.hero._dismountMotion)return;
    if(!this.dragon.riding){
      const distance=this.hero.group.position.distanceTo(this.dragon.group.position);
      if(distance>10.5){this.ui.toast('Aproxime-se do dragão para montar.');this.audio.play('error');return;}
      this.dragon.mount();this.hero.setMounted(true);this.audio.play('mount');this.saveGame();
      if(this.missions.finishBond())this.ui.toast('Nimbo confia em você! Atravesse o primeiro aro luminoso.',5);
      else this.ui.toast('Montado! W acelera · Espaço sobe · Ctrl desce.');
      return;
    }
    const {x,z,y}=this.dragon.group.position;
    const h=this.world.groundHeightAt(x,z);
    if(this.dragon.airborne || y-h>4.7 || this.dragon.speed>11 || !this.world.walkable(x,z)){
      this.ui.toast('Para desmontar: pouse numa ilha e reduza a velocidade.');this.audio.play('error');return;
    }
    const spot=safeDismountSpot({x,z},{obstacles:this.world.obstacles,walkable:(a,b)=>this.world.walkable(a,b),groundAt:(a,b)=>this.world.groundHeightAt(a,b,.52)});
    if(!spot){this.ui.toast('Não há espaço livre para desmontar aqui. Mova Nimbo para um local aberto.');this.audio.play('error');return;}
    this.dragon.dismount();
    this.hero.setMounted(false,{dismountTarget:spot});
    // Procedural fallback has no mounted GLB; keep legacy instant dismount.
    if(!this.hero._dismountMotion)this.hero.group.position.set(spot.x,spot.y,spot.z);
    this.ui.toast('Você desmontou do dragão.');this.saveGame();
  }
  getProjectile(owner){
    // Reuse the entire projectile record and its velocity vector, not just the mesh.
    const bullet=this.projectilePool.pop()??{
      mesh:new THREE.Mesh(this.projectileGeometry,this.projectileMaterials[owner]),
      velocity:new THREE.Vector3(),life:0,owner
    };
    bullet.owner=owner;
    bullet.mesh.material=this.projectileMaterials[owner];bullet.mesh.visible=true;
    return bullet;
  }
  recycleProjectileAt(index){
    const bullet=this.projectiles[index];
    this.scene.remove(bullet.mesh);
    this.projectilePool.push(bullet);
    this.projectiles.splice(index,1);
  }
  spawnProjectile(origin,direction,owner){
    const cap=projectileLimit(this.graphics.tier);
    const admission=projectileAdmission(this.projectiles,owner,cap);
    if(!admission.allowed)return false;
    if(admission.evictIndex>=0)this.recycleProjectileAt(admission.evictIndex);
    const bullet=this.getProjectile(owner),mesh=bullet.mesh;
    mesh.position.copy(origin);mesh.scale.setScalar(owner==='enemy'?1.9:1.5);
    this.scene.add(mesh);
    const speed=owner==='enemy'?56:95;
    bullet.velocity.copy(direction).multiplyScalar(speed);
    bullet.life=owner==='enemy'?3.2:2.4;
    this.projectiles.push(bullet);
    this.audio.play(owner==='enemy'?'enemyFire':'fire');
    return true;
  }
  fire(){
    if(!this.dragon.riding){this.ui.toast('Monte no seu dragão primeiro.');return;}
    if(this.missions.stage<3){this.ui.toast('Fogo bloqueado: complete a missão das runas.');return;}
    if(this.dragon.fireCooldown>0)return;
    const stats=this.progression.stats;
    if(this.dragon.energy<stats.fireCost){this.ui.toast('Energia insuficiente para lançar fogo.');return;}
    // Only spend stamina when an actual projectile can be scheduled.
    this.dragon.triggerAttack();
    this.projectileMaterials.player.color.setHex(this.progression.species==='brasa'?0xff6542:this.progression.species==='raio'?0x9dd8ff:0xffb65a);
    const direction=this.dragon.forward();
    // Assistência de mira limitada ao campo frontal. Exige apontar para o alvo.
    let bestDot=.77,bestFound=false;
    // No arrays or cloned vectors on every fire input.
    const candidates=this.inMountain&&this.mountain?(this.expedition.phase==='boats'?this.mountain.boats:this.expedition.phase==='boss'?[this.mountain.boss]:[]):
      this.missions.stage===3?this.missions.targets:this.missions.stage===4?
        [...this.enemies.enemies,...this.frontier.activeGuardians]:this.frontier.activeGuardians;
    const shooter=this.dragon.group.position;
    for(const candidate of candidates){
      if(this.inMountain&&this.expedition.phase==='boats'&&!candidate.visible)continue;
      if(this.missions.stage===3&&!this.inMountain&&candidate.userData.destroyed)continue;
      if(this.missions.stage===4&&!this.inMountain&&!candidate.alive)continue;
      const target=candidate.position;
      const dx=target.x-shooter.x,dy=target.y-shooter.y,dz=target.z-shooter.z;
      const distance=Math.hypot(dx,dy,dz);
      if(distance<.001||distance>=164)continue;
      const dot=(direction.x*dx+direction.y*dy+direction.z*dz)/distance;
      if(dot>bestDot){this._aimBest.set(dx/distance,dy/distance,dz/distance);bestFound=true;bestDot=dot;}
    }
    // Short-range aim assist for active fire beacons; never target completed ones.
    if(!this.inMountain&&this.missions.stage>=3){
      for(const marker of this.villagers.markers){
        if(marker.id!=='brasas'||!marker.group.visible)continue;
        const target=marker.group.position;
        const dx=target.x-shooter.x,dy=target.y-shooter.y,dz=target.z-shooter.z;
        const distance=Math.hypot(dx,dy,dz);
        if(distance<.001||distance>=164)continue;
        const dot=(direction.x*dx+direction.y*dy+direction.z*dz)/distance;
        if(dot>bestDot){this._aimBest.set(dx/distance,dy/distance,dz/distance);bestFound=true;bestDot=dot;}
      }
    }
    if(bestFound)direction.lerp(this._aimBest,.86).normalize();
    const start=this.dragon.group.localToWorld(this._fireStart.set(0,.48,-4.4));
    if(this.spawnProjectile(start,direction,'player')){
      this.dragon.fireCooldown=stats.fireCooldown;this.dragon.energy-=stats.fireCost;
      this.effects.burst(start,'fire',7);
    }
  }
  takeDamage(amount){
    // The short lateral evasive window avoids a projectile, even if its
    // swept sphere intersects the player on this frame.
    if(!this.dragon.riding||this.hurtImmunity>0||this.dragon.dodgeRemaining>0)return false;
    this.hurtImmunity=.9;this.hitFlash=.5;this.health=Math.max(0,this.health-amount);
    this.dragon.triggerHurt();
    this.audio.play('hurt');
    this.effects.burst(this.dragon.group.position,'enemy',10);
    if(this.health<=0){
      this.health=100;this.resetPosition(true);
      this.needsProjectileClear=true;
      this.hurtImmunity=3;
      this.ui.toast('O dragão foi derrubado! Vocês voltaram à vila. A missão continua.',6);
    }else this.ui.toast(`O dragão sofreu dano! Resistência: ${this.health}%`,2);
    return true;
  }
  clearProjectiles(){
    while(this.projectiles.length)this.recycleProjectileAt(this.projectiles.length-1);
  }
  updateProjectiles(dt){
    for(let i=this.projectiles.length-1;i>=0;i--){
      const bullet=this.projectiles[i];bullet.life-=dt;
      const from=this._projectileFrom.copy(bullet.mesh.position);
      const to=this._projectileTo.copy(from).addScaledVector(bullet.velocity,dt);
      bullet.mesh.position.copy(to);bullet.mesh.rotation.x+=dt*7;
      bullet.mesh.scale.setScalar((bullet.owner==='enemy'?1.55:1.25)+Math.sin(bullet.life*26)*.13);
      let hit=false;
      if(bullet.owner==='player'){
        if(this.inMountain&&this.mountain){
          if(this.expedition.phase==='boats'){
            for(let k=0;k<this.mountain.boats.length;k++){
              const ship=this.mountain.boats[k];
              if(!ship.visible)continue;
              if(segmentSphereHit(from,to,ship.position,11)){
                const result=this.expedition.hitBoat(k);hit=result.hit;
                this.effects.burst(ship.position,'impact',15);this.audio.play('hit');
                this.mountain.notifyBoatHit(k,result);
                this.mountain.refresh();this.ui.toast(result.sunk?`Barco afundado! ${this.expedition.boatsSunk}/3`: 'Barco atingido: acerte novamente!',4);
                if(result.sunk&&this.expedition.phase==='boss')this.ui.toast('Os barcos caíram! Enfrente o dragão gigante!',6);
                this.saveGame();break;
              }
            }
          }else if(this.expedition.phase==='boss'&&segmentSphereHit(from,to,this.mountain.boss.position,16)){
            const counter=counterStrike(this.bossCounterTime);
            const result=this.expedition.hitBoss(counter.damage);hit=result.hit;this.effects.burst(this.mountain.boss.position,'fire',17);
            if(counter.bonus&&result.hit){
              this.bossCounterTime=0;this.bossAttackState={elapsed:0,warned:false};this.bossWarnedPattern=null;this.mountain.setBossWarning(false);
              this.ui.toast('✦ CONTRA-ATAQUE! O dragão gigante cambaleou! DANO DUPLO.',3);
            }
            this.audio.play('hit');this.mountain.flashBossHit();this.mountain.refresh();
            this.ui.toast(result.defeated?'Dragão gigante derrotado! Volte a oeste pelo portal.':`Dragão gigante: ${this.expedition.bossHealth}/12`,4);
            this.saveGame();
          }
        }
        if(!hit&&!this.inMountain&&this.missions.stage>=3){
          for(const marker of this.villagers.markers){
            if(marker.id!=='brasas'||!marker.group.visible)continue;
            if(segmentSphereHit(from,to,marker.group.position,5.4)&&this.contracts.ignite(marker.id,marker.index)){
              hit=true;this.effects.burst(marker.group.position,'fire',10);
              this.audio.play('complete');this.villagers.refresh(this.contracts);
              const state=this.contracts.state.brasas;
              this.ui.toast(state.status==='ready'?'Três faróis acesos! Volte para Suri.':`Farol aceso! ${state.collected.filter(Boolean).length}/3`,4);
              this.saveGame();break;
            }
          }
        }
        if(!hit&&!this.inMountain&&this.missions.stage===3){
          for(let k=0;k<this.missions.targets.length;k++){
            const target=this.missions.targets[k];
            if(!target.userData.destroyed&&segmentSphereHit(from,to,target.position,7.5)){
              this.effects.burst(target.position,'fire',15);
              this.missions.hitTarget(k);
              this.ui.toast(this.missions.complete?'TODAS AS MISSÕES CONCLUÍDAS!':`Orbe destruído!`,3);
              hit=true;break;
            }
          }
        }
        if(!hit&&!this.inMountain&&this.missions.stage===4){
          for(const enemy of this.enemies.alive){
            if(segmentSphereHit(from,to,enemy.position,5.6)){
              const dead=enemy.takeHit(this.progression.stats.fireDamage);
              this.effects.burst(enemy.position,dead?'fire':'impact',dead?22:9);
              this.audio.play('hit');
              if(dead){
                this.missions.enemyDefeated();
                this.ui.toast(this.missions.stage===5?'Céus seguros! Agora resgate os filhotes.':`Dragão sombrio derrotado! ${this.missions.progress}/3`,5);
              } else this.ui.toast(`Sentinela atingida · ${Math.ceil(enemy.health)}/${enemy.maxHealth} de resistência`,2);
              hit=true;break;
            }
          }
        }
        if(!hit&&!this.inMountain){
          const strike=this.frontier.hitGuardian(from,to,this.progression.stats.fireDamage);
          if(strike){
            hit=true;this.audio.play('hit');
            this.effects.burst(strike.position,strike.reward?'fire':'impact',strike.reward?18:7);
            if(strike.reward){
              this.progression.grant(strike.reward);this.saveGame();
              this.ui.toast(`${strike.name} derrotado! +${strike.reward} pontos de treino.`,5);
              this.ui.renderStable(this);
            }else this.ui.toast(`${strike.name}: ${Math.ceil(strike.health)} de resistência`,2);
          }
        }
      } else if((this.missions.stage===4||this.inMountain||this.frontier.activeGuardians.length>0)&&this.dragon.riding&&segmentSphereHit(from,to,this.dragon.group.position,4.2)){
        this.takeDamage(16);hit=true;
      }
      if(hit||bullet.life<=0||to.y<-.9)this.recycleProjectileAt(i);
    }
    if(this.needsProjectileClear){this.clearProjectiles();this.needsProjectileClear=false;}
  }
  handleFrontierEvent(event){
    if(event.type==='relic'){
      this.audio.play('pickup');
      this.effects.burst(new THREE.Vector3(event.position.x,event.position.y,event.position.z),'rescue',8);
      this.ui.toast(`${event.label} recuperado · ${event.count}/3 em ${event.name}.`,4);
      // Completion is awarded and saved atomically in the next event.
      if(event.count<3)this.saveGame();
    }else if(event.type==='relic-complete'){
      this.progression.grant(event.points);
      this.audio.play('complete');
      this.ui.toast(`EXPEDIÇÃO CONCLUÍDA — ${event.name}! +${event.points} pontos de treino.`,7);
      this.saveGame();this.ui.renderStable(this);
    }
  }
  updateDiscoveries(){
    const p=this.dragon.riding?this.dragon.group.position:this.hero.group.position;
    const discovered=this.landmarks.tryDiscover(p,this.discovery);
    if(discovered){
      this.progression.grant(1);this.saveGame();this.audio.play('complete');
      this.ui.toast(`Novo marco: ${discovered.name}! +1 ponto de treinamento (${this.discovery.total}/${LANDMARKS.length}).`,5);
      this.ui.renderStable(this);
    }
  }
  updateCamera(dt){
    const riding=this.dragon.riding;
    const focus=riding?this.dragon.group.position:this.hero.group.position;
    // Orbit yaw is a WORLD heading, independent of the dragon's steering.
    // Rotating the view changes where W moves without dragging the camera
    // back toward the old movement direction every frame.
    const yaw=this.cameraOrbit.yaw;
    const forwardX=-Math.sin(yaw),forwardZ=-Math.cos(yaw);
    const airborne=riding&&this.dragon.airborne;
    const visual=this.dragon.externalDragonModel;
    const framing=dragonCameraFraming({riding,airborne,speed:this.dragon.speed,
      visualHeight:visual?.visualHeight,visualWingspan:visual?.visualWingspan,
      zoom:this.cameraOrbit.zoom,aspect:this.camera.aspect});
    const offset=cameraOffset({forwardX:0,forwardZ:-1,distance:framing.distance,yaw,pitch:this.cameraOrbit.pitch});
    const camPos=new THREE.Vector3(focus.x+offset.x,focus.y+framing.baseHeight+offset.y,focus.z+offset.z);
    camPos.y=Math.max(camPos.y,this.world.groundHeightAt(camPos.x,camPos.z)+3.5);
    // Collisions and landscape keep their full sweep checks even on tight turns.
    const followTarget=this.camera.position.clone().lerp(camPos,smoothFollow(airborne?3.8:riding?5.3:6.3,dt));
    const cameraAnchor={x:focus.x,y:focus.y+framing.anchorHeight,z:focus.z};
    const safeCamera=resolveCameraPosition(cameraAnchor,followTarget,this.world.obstacles,
      (x,z)=>this.world.heightAt(x,z),{radius:.45,groundClearance:1.1});
    this.camera.position.set(safeCamera.x,safeCamera.y,safeCamera.z);
    // Look a few meters ahead along the VIEW, not the actor's previous yaw.
    // Maintain independent pitch, avoid head bob and drifting off-screen.
    const lookAt=new THREE.Vector3(focus.x+forwardX*framing.lookAhead,
      focus.y+framing.lookHeight,focus.z+forwardZ*framing.lookAhead);
    this._camTarget??=lookAt.clone();
    this._camTarget.lerp(lookAt,smoothFollow(airborne?4.0:6.2,dt));
    this.camera.lookAt(this._camTarget);
    const fov=riding?67+Math.min(this.dragon.speed*.24,11):67;
    this.camera.fov=THREE.MathUtils.damp(this.camera.fov,fov,3,dt);this.camera.updateProjectionMatrix();
  }
  resetPosition(respawn=false){
    if(this.inMountain){this.inMountain=false;this.expedition.inRegion=false;this.unloadMountain();}
    const x=8,z=7;this.dragon.group.position.set(x,this.world.groundHeightAt(x,z)+2.58,z);
    this.dragon.yaw=-.5;this.dragon.turnAxis=0;this.dragon.speed=0;this.dragon.airborne=false;this.dragon.energy=Math.max(35,this.dragon.energy);
    if(!this.dragon.riding)this.hero.group.position.set(2,this.world.groundHeightAt(2,11,.52),11);
    if(!respawn)this.ui.toast('Posição restaurada ao vilarejo.');
    this.saveGame();
    this.camera.position.set(x+12,this.dragon.group.position.y+12,z+19);
    this._camTarget?.copy(this.dragon.group.position);
  }
  navigateStable(direction){
    const root=document.getElementById('stable');
    const buttons=Array.from(root.querySelectorAll('button:not(:disabled)')).filter(b=>b.offsetParent!==null);
    if(!buttons.length)return;
    const current=buttons.indexOf(document.activeElement);
    const next=(current+direction+buttons.length)%buttons.length;
    buttons[next].focus();
  }
  frame(){
    const realDt=this.clock.getDelta();
    if(shouldSkipRendering({hidden:document.hidden,webglLost:this.webglLost})){
      this.fpsTime=0;this.frames=0;this.input.clearActions();return;
    }
    const dt=Math.min(realDt,.05);this.elapsed+=dt;
    this.input.update();
    // Time the same static frame at each graphics tier. Pause simulation,
    // AI, physics and saves during the brief measurement, preventing scene
    // changes or in-game damage from invalidating the comparison.
    if(this.started){
      if(this.input.consume('b'))this.toggleBenchmark();
      if(this.benchmark.active){
        if(this.input.consume('f3'))this.toggleDiagnostics();
        if(this.input.consume('g'))this.cycleGraphics();
        if(this.input.consume('t')||this.input.consume('start'))this.toggleStable();
        if(this.benchmark.active){
          this.renderer.render(this.scene,this.camera);
          this.updateBenchmark(realDt);
          return;
        }
      }
    }
    const controllerConnected=this.input.pad.connected;
    if(controllerConnected!==this.controllerWasConnected){
      this.controllerWasConnected=controllerConnected;
      const status=document.getElementById('controller-status');
      if(status){status.textContent=controllerConnected?'🎮 CONTROLE CONECTADO':'TECLADO / TOQUE';status.classList.toggle('connected',controllerConnected);}
      if(controllerConnected&&this.started)this.ui.toast('Controle detectado: analógico esquerdo move, direito controla a câmera.',4);
    }
    if(this.input.lookAxis && this.started && this.ui.stable.classList.contains('hidden') && !this.ui.dialogueOpen){
      const look=this.input.lookAxis;
      if(Math.abs(look.x)>.001||Math.abs(look.y)>.001)this.cameraOrbit.drag(look.x*210*dt,look.y*150*dt);
    }
    if(!this.started && (this.input.consume('start')||this.input.consume('e'))){this.start();}

    this.world.update(dt,this.elapsed);
    this.landmarks.update(this.elapsed,this.discovery);
    if(this.started){
      const focus=this.dragon.riding?this.dragon.group.position:this.hero.group.position;
      this.dayNight.update(dt,focus);
      if(this.contracts.syncDay(this.dayNight.state.day)){
        this.villagers.refresh(this.contracts);this.ui.toast(`DIA ${this.dayNight.state.day}: novas tarefas diárias disponíveis na vila!`,5);this.saveGame();
      }
      const weatherChanged=this.weather.update(dt,this.elapsed,focus,this.dayNight.state.phase);
      if(weatherChanged)this.ui.toast(`Clima mudou: ${this.weather.mode.label}`,4);
    }
    if(this.started){
      if(this.input.consume('t')||this.input.consume('start'))this.toggleStable();
      if(this.input.consume('escape')){this.ui.stable.classList.add('hidden');this.ui.hideDialogue();document.getElementById('gpu-panel').classList.add('hidden');}
      if(this.input.consume('p'))this.saveGame(true);
      if(this.input.consume('c')){this.weather.cycle();this.saveGame();this.ui.toast(`Clima: ${this.weather.mode.label}`,3);}
      if(this.input.consume('g'))this.cycleGraphics();
      if(this.input.consume('f3'))this.toggleDiagnostics();
      if(this.input.consume('v')){this.cameraOrbit.reset();this.cameraOrbit.yaw=this.dragon.riding?this.dragon.yaw:this.hero.group.rotation.y;this.ui.toast('Câmera atrás do personagem.');}
      if(this.input.consume('n')){this.dayNight.jumpHours(3);if(this.contracts.syncDay(this.dayNight.state.day))this.villagers.refresh(this.contracts);this.saveGame();this.ui.toast(`Dia ${this.dayNight.state.day} · Hora ${this.dayNight.clock}`,3);}
      if(!this.ui.stable.classList.contains('hidden')){
        if(this.input.consume('menuup')||this.input.consume('menuleft'))this.navigateStable(-1);
        if(this.input.consume('menudown')||this.input.consume('menuright'))this.navigateStable(1);
        if(this.input.consume('e')&&this.input.pad.connected){const active=document.activeElement; if(active?.tagName==='BUTTON'&&this.ui.stable.contains(active))active.click();}
        this.input.clearActions();this.input.down.clear();
        try{this.stablePreview?.render(dt);}catch(error){
          console.warn('Renderização 3D do estábulo indisponível:',error);
          this.stablePreview=null;
          document.getElementById('stable-preview-caption').textContent='Prévia 3D indisponível neste dispositivo; escolha pelos cartões abaixo.';
        }
        return;
      } else {
      if(this.input.consume('e')){if(this.ui.dialogueOpen)this.ui.hideDialogue();else if(!this.interactVillager()&&!this.interactWildDragon())this.mountOrDismount();}
      if(this.input.consume('f'))this.fire();
      if(!this.ui.dialogueOpen&&this.input.consume('q')){
        const sideways=this.input.axis('a','d');
        if(this.dragon.tryDodge(sideways)){
          this.ui.toast('ESQUIVA! ✦ Ataques evitados por um instante.',1.2);
        }else if(this.dragon.riding&&this.dragon.airborne){
          this.ui.toast('Esquiva indisponível: aguarde a recarga ou recupere energia.',2);
        }
      }
      if(this.input.consume('r'))this.resetPosition();
      if(this.input.consume('m')){this.audio.muted=!this.audio.muted;this.ui.toast(this.audio.muted?'Áudio desativado':'Áudio ativado');}
      }
      if(this.ui.dialogueOpen)this.input.down.clear();
      // Both movement controllers read the exact same horizontal camera yaw.
      this.input.cameraYaw=this.cameraOrbit.yaw;
      this.dragon.setWind(this.weather.mode.wind);
      this.dragon.update(dt,this.input,this.elapsed);
      if(this.dragon.contactPulse>0){
        const d=this.dragon,p=d.group.position;
        const count=contactBurstSize(d.contactKind,d.contactSpeed,
          this.world.walkable(p.x,p.z),this.graphics.tier);
        if(count){
          this._groundContactPosition.set(p.x,this.world.groundHeightAt(p.x,p.z,1.15)+.3,p.z);
          this.effects.burst(this._groundContactPosition,'impact',count);
        }
        d.contactPulse=0;d.contactKind=null;
      }
      if(this.dragon.impactPulse>0){
        this.effects.burst(this.dragon.group.position,'impact',Math.min(10,Math.ceil(7*this.dragon.impactPulse)));
        this.audio.play('hit');
        this.dragon.impactPulse=0;
      }
      this.hero.update(dt,this.input,this.elapsed);
      this.missions.update(dt,this.elapsed,this.dragon,text=>this.ui.toast(text));
      this.updateContracts();
      this.updateDiscoveries();
      const frontierEvents=this.frontier.update(dt,this.elapsed,this.dragon,
        (origin,direction)=>this.spawnProjectile(origin,direction,'enemy'),this.missions.stage>=3);
      for(const event of frontierEvents)this.handleFrontierEvent(event);
      this.villagers.update(dt,this.elapsed);
      this.wildDragons.update(dt,this.elapsed,this.hero.group.position,this.dragon.riding,this.hero.moveSpeed);
      const trainMsg=this.training.update(dt,this.elapsed,this.dragon);
      if(trainMsg)this.ui.toast(trainMsg,4);
      this.autoSaveTime+=dt;
      if(this.autoSaveTime>15){this.autoSaveTime=0;this.saveGame();}
      this.enemies.update(dt,this.elapsed,this.dragon,(origin,direction)=>this.spawnProjectile(origin,direction,'enemy'));
      this.updateProjectiles(dt);
      this.updateExpedition(dt);
      this.effects.update(dt);
      this.hurtImmunity=Math.max(0,this.hurtImmunity-dt);
      this.hitFlash=Math.max(0,this.hitFlash-dt);
      this.ui.update(dt,this);
    }else this.dragon.update(dt,{isDown:()=>false},this.elapsed);
    this.updateCamera(dt);
    this.updateActorDetail();
    this.world.updateDetail(this.camera.position,dt);
    this.renderer.render(this.scene,this.camera);
    const benchmarking=this.benchmark.active;
    if(benchmarking)this.updateBenchmark(realDt);
    this.fpsTime+=realDt;this.frames++;
    if(this.fpsTime>=1){const fps=Math.round(this.frames/this.fpsTime);this.lastKnownFPS=fps;this.ui.setFPS(fps);this.renderDiagnostics(fps);
      if(this.started && !document.hidden && !benchmarking && this.graphics.sample(fps)){this.applySceneQuality();this.updateGraphicsLabel();this.ui.toast(`Ajuste automático: gráficos ${this.graphics.label}`,3);}
      this.fpsTime=0;this.frames=0;}
  }
}
