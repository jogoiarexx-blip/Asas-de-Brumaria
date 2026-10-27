import * as THREE from 'three';
import {buildWarmupPlan,partitionWarmup} from './GraphicsWarmupPlan.js';

const nextFrame=()=>new Promise(resolve=>{
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(resolve);
  else setTimeout(resolve,0);
});

/** GPU preparation must run AFTER Play is pressed and BEFORE simulation starts.
 * It never edits the quality tier, never advances world/update(), never changes
 * the original scene's mesh visibility, and compiles inactive effects/enemies.
 */
export class GraphicsWarmup{
  constructor(renderer,scene,camera,{onProgress=()=>{},yieldFrame=nextFrame}={}){
    this.renderer=renderer;this.scene=scene;this.camera=camera;
    this.onProgress=onProgress;this.yieldFrame=yieldFrame;
    this.report={textures:0,shaderBatches:0,shadowPasses:0,failures:[]};
  }
  groups(game){
    return [
      {name:'Personagem e dragão',roots:[game.hero.group,game.dragon.group]},
      {name:'Inimigos e criaturas',roots:[
        ...game.enemies.enemies.map(e=>e.group),
        ...game.wildDragons.creatures.map(e=>e.group),
        ...game.villagers.npcs.map(e=>e.root),
        ...[...game.frontier.guardians.values()].map(e=>e.group)
      ]},
      {name:'Fogo e efeitos',roots:[
        ...Object.values(game.effects.buckets).map(b=>b.mesh),
        game.effects.pulseRing,
        ...game.projectilePool.slice(0,2).map(p=>p.mesh)
      ]},
      {name:'Vegetação, terreno e sombras',roots:[game.scene]}
    ];
  }
  async compileBatch(batch){
    // Temporary scene nodes SHARE geometry/materials with gameplay actors.
    // This triggers their exact material programs, including skinned meshes,
    // instancing and otherwise invisible enemies. No scene objects are moved.
    const staging=new THREE.Scene();
    staging.fog=this.scene.fog;
    for(const {mesh} of batch){
      const proxy=mesh.clone(false);
      proxy.visible=true;
      if(proxy.isInstancedMesh&&proxy.count===0)proxy.count=1;
      proxy.frustumCulled=false;
      staging.add(proxy);
    }
    try{
      if(typeof this.renderer.compileAsync==='function')
        await this.renderer.compileAsync(staging,this.camera,this.scene);
      else if(typeof this.renderer.compile==='function')
        this.renderer.compile(staging,this.camera,this.scene);
    }finally{
      staging.clear(); // Do not dispose shared meshes, textures or materials.
    }
  }
  async run(game){
    const {variants,textures}=buildWarmupPlan(this.groups(game));
    const batches=partitionWarmup(variants,8);
    const total=textures.length+batches.length+1;
    let completed=0;
    const step=label=>this.onProgress({percent:Math.min(100,Math.round(completed/Math.max(1,total)*100)),label,completed,total});
    step('Preparando texturas e materiais…');
    const record=(category,error)=>{
      this.report.failures.push(`${category}: ${error?.message??error}`);
      console.warn('[GPU warmup]',category,error);
    };
    // initTexture uploads existing Canvas/GLB textures; it does not change
    // filtering, image resolution, anisotropy or quality configuration.
    for(const texture of textures){
      try{
        if(typeof this.renderer.initTexture==='function'){
          this.renderer.initTexture(texture);this.report.textures++;
        }
      }catch(error){record('Textura',error);}
      completed++;step('Preparando texturas…');await this.yieldFrame();
    }
    for(const batch of batches){
      try{await this.compileBatch(batch);this.report.shaderBatches++;}
      catch(error){record('Shader '+batch[0].name,error);}
      completed++;step('Compilando: '+batch[0].name+'…');await this.yieldFrame();
    }
    // A real scene render during the loading overlay also initializes shadow
    // render targets/depth shader variants and existing instanced buffers.
    // No AI, animation or physics are advanced. Visibility is left unchanged.
    try{
      if(!game.webglLost){
        this.renderer.shadowMap.needsUpdate=true;
        this.renderer.render(this.scene,this.camera);
        this.report.shadowPasses++;
      }
    }catch(error){record('Mapas de sombras',error);}
    completed++;step('Sombras e efeitos preparados');
    return this.report;
  }
}
