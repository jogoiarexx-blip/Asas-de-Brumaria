import * as THREE from 'three';
import {TERRAIN_LOD,coastDistance,prioritizeIslandLevels} from './TerrainTextureLOD.js';

/** Poly Haven CC0 island terrain: 512px far, 1024px mid, 2048px + normals near.
 * Shared biome textures use one GPU image but independent per-island materials. */
export const TERRAIN_KINDS=Object.freeze(['meadow','beach','stone','ash','crystal']);
export const TERRAIN_TEXTURE_ROOT='./assets/textures/terrain/';
export function textureTier(quality){return quality==='quality'?'desktop':'mobile';}
export function terrainKind(island){
  if(island?.biome==='ash')return 'ash';
  if(island?.biome==='crystal')return 'crystal';
  if(island?.name==='Atol Esquecido')return 'beach';
  if(island?.name==='Ilha do Farol'||island?.name==='Ilha da Névoa')return 'stone';
  return 'meadow';
}
export function textureFile(kind,channel,tier){
  if(!TERRAIN_KINDS.includes(kind)||!['diff','normal'].includes(channel)
    ||!['low','mobile','desktop'].includes(tier)||channel==='normal'&&tier==='low')
    throw Error('Unknown terrain PBR map');
  return `${TERRAIN_TEXTURE_ROOT}${kind}_${channel}_${tier}.webp`;
}
export const TERRAIN_STREAMING=Object.freeze({
  prefetchDistance:TERRAIN_LOD.mediumEnter,
  releaseDistance:TERRAIN_LOD.lowLeave,
  evictionSeconds:TERRAIN_LOD.evictionSeconds
});
export function desiredTerrainKinds(observer,islands,previous=new Set()){
  if(!observer||!Number.isFinite(observer.x)||!Number.isFinite(observer.z))
    return new Set(previous);
  return new Set(islands.filter(i=>coastDistance(observer,i)<=
    (previous.has(terrainKind(i))?TERRAIN_LOD.lowLeave:TERRAIN_LOD.lowEnter))
    .map(terrainKind));
}
const deferIdle=callback=>{
  if(typeof globalThis.requestIdleCallback==='function')
    globalThis.requestIdleCallback(callback,{timeout:3500});
  else setTimeout(()=>callback({didTimeout:true,timeRemaining:()=>8}),48);
};

export class TerrainTextureManager {
  constructor(renderer=null,{loader=null,idle=null}={}){
    this.renderer=renderer;
    this.loader=loader??new THREE.TextureLoader();
    this.scheduleIdle=idle??deferIdle;
    this.placeholder=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
    this.placeholder.colorSpace=THREE.SRGBColorSpace;
    this.placeholder.needsUpdate=true;
    // Prepare the near-tier normal shader once during graphics warmup.
    this.neutralNormal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
    this.neutralNormal.needsUpdate=true;
    this.materials=new Map();
    this.registrations=new Map(); // island name -> {island,kind,material}
    this.levels=new Map();        // island name -> target LOD
    this.activeKinds=new Set();
    this.loading=new Map();       // URL -> shared resident GPU-ready texture
    this.queue=[];this.queued=new Map();this.busy=false;
    this.tier=null;this.quality='balanced';this.serial=0;
    this.failed=new Set();this.lastSeen=new Map();this.retireTimers=new Map();
    this.focus=null;this.islands=[];
    this.stats={requests:0,uploads:0,evictions:0,discarded:0,upgrades:0,downgrades:0};
  }
  register(kind,material,island=null){
    if(!TERRAIN_KINDS.includes(kind))throw Error('Unknown terrain kind');
    const group=this.materials.get(kind)??[];
    group.push(material);this.materials.set(kind,group);
    const id=island?.name??`${kind}-legacy-${group.length}`;
    this.registrations.set(id,{island:island??null,kind,material});
    if(!material.map){material.map=this.placeholder;material.needsUpdate=true;}
  }
  _desiredURLs(){
    const needed=new Set();
    for(const [id,level] of this.levels){
      const item=this.registrations.get(id);
      if(!item||!level)continue;
      needed.add(textureFile(item.kind,'diff',level));
      if(level==='desktop')needed.add(textureFile(item.kind,'normal','desktop'));
      if(item.material.map===this.placeholder)
        needed.add(textureFile(item.kind,'diff','low'));
    }
    return needed;
  }
  _queueJob(kind,channel,tier,priority){
    const url=textureFile(kind,channel,tier);
    if(this.loading.has(url)||this.failed.has(url))return;
    const queued=this.queued.get(url);
    if(queued){queued.priority=Math.min(queued.priority,priority);return;}
    const job={kind,channel,tier,url,priority};
    this.queued.set(url,job);this.queue.push(job);
  }
  _requestForIsland(entry,distance){
    const {kind,material,island}=entry,level=this.levels.get(island?.name);
    if(!level)return;
    // Start on a cheap preview. Never decode many 2K maps at once.
    if(material.map===this.placeholder)this._queueJob(kind,'diff','low',distance-20);
    const priority=distance+(level==='low'?40:level==='mobile'?10:0);
    this._queueJob(kind,'diff',level,priority);
    if(level==='desktop')this._queueJob(kind,'normal','desktop',priority+50);
  }
  _applyLevel(id){
    const entry=this.registrations.get(id),level=this.levels.get(id);
    if(!entry||!level)return;
    const {kind,material}=entry;
    // Keep the previous photo until its replacement has been GPU-prewarmed.
    const desired=this.loading.get(textureFile(kind,'diff',level));
    const preview=this.loading.get(textureFile(kind,'diff','low'));
    const map=desired??(material.map===this.placeholder?preview:null);
    if(map&&material.map!==map){
      const before=material.map?.image?.width??0,after=map.image?.width??0;
      material.map=map;material.color.setScalar(1.65);
      if(after>before)this.stats.upgrades++;
      if(after<before)this.stats.downgrades++;
    }
    const normal=(this.quality==='quality'
      ?(level==='desktop'?this.loading.get(textureFile(kind,'normal','desktop')):null)??this.neutralNormal
      :null);
    if(material.normalMap!==normal){
      material.normalMap=normal;material.needsUpdate=true;
    }
  }
  _attachTexture(kind,channel,tier,texture){
    for(const [id,entry] of this.registrations){
      if(entry.kind!==kind||!this.levels.has(id))continue;
      const level=this.levels.get(id);
      if((channel==='normal'&&level==='desktop')||channel==='diff'&&
        (level===tier||tier==='low'&&entry.material.map===this.placeholder))
        this._applyLevel(id);
    }
  }
  async _pump(){
    if(this.busy)return;
    this.busy=true;
    try{
      while(this.queue.length){
        this.queue.sort((a,b)=>a.priority-b.priority);
        const job=this.queue.shift();this.queued.delete(job.url);
        if(!this._desiredURLs().has(job.url)||this.loading.has(job.url)||this.failed.has(job.url))continue;
        let texture;
        try{
          this.stats.requests++;
          texture=await this.loader.loadAsync(job.url);
          texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
          texture.colorSpace=job.channel==='diff'?THREE.SRGBColorSpace:THREE.NoColorSpace;
          texture.anisotropy=job.channel==='diff'?8:4;
          texture.generateMipmaps=true;
          texture.minFilter=THREE.LinearMipmapLinearFilter;
          texture.magFilter=THREE.LinearFilter;
        }catch(error){
          if(!this.failed.has(job.url)){
            this.failed.add(job.url);
            console.warn('[Terrain CC0] Procedural fallback for missing '+job.url,error?.message??error);
          }
          continue;
        }
        if(!this._desiredURLs().has(job.url)){
          texture.dispose();this.stats.discarded++;continue;
        }
        await new Promise(resolve=>{
          const warm=deadline=>{
            if(deadline&&!deadline.didTimeout&&deadline.timeRemaining()<9){
              this.scheduleIdle(warm);return;
            }
            if(!this._desiredURLs().has(job.url)){
              texture.dispose();this.stats.discarded++;resolve();return;
            }
            try{
              this.renderer?.initTexture?.(texture);
              if(typeof this.renderer?.initTexture==='function')this.stats.uploads++;
            }catch(error){
              console.warn('[Terrain CC0] GPU prewarm unavailable; normal renderer fallback.',error?.message??error);
            }
            this.loading.set(job.url,texture);
            this._attachTexture(job.kind,job.channel,job.tier,texture);
            this.scheduleIdle(()=>this._pruneUnused());
            resolve();
          };
          this.scheduleIdle(warm);
        });
      }
    }finally{this.busy=false;if(this.queue.length)this._pump();}
  }
  _pruneUnused(){
    const keep=new Set();
    for(const entry of this.registrations.values()){
      if(entry.material.map)keep.add(entry.material.map);
      if(entry.material.normalMap)keep.add(entry.material.normalMap);
    }
    for(const [url,texture] of this.loading){
      if(keep.has(texture))continue;
      this.loading.delete(url);texture.dispose();this.stats.evictions++;
    }
  }
  _retire(id){
    if(this.retireTimers.has(id))return;
    const timer=setTimeout(()=>{
      this.retireTimers.delete(id);
      if(this.levels.has(id))return;
      const elapsed=(typeof performance!=='undefined'?performance.now():Date.now())-(this.lastSeen.get(id)??0);
      if(elapsed<TERRAIN_LOD.evictionSeconds*1000){this._retire(id);return;}
      const material=this.registrations.get(id)?.material;
      if(!material)return;
      material.map=this.placeholder;material.color.setScalar(1);
      const normal=this.quality==='quality'?this.neutralNormal:null;
      if(material.normalMap!==normal){material.normalMap=normal;material.needsUpdate=true;}
      this.scheduleIdle(()=>this._pruneUnused());
    },TERRAIN_LOD.evictionSeconds*1000);
    timer.unref?.();
    this.retireTimers.set(id,timer);
  }
  updateFocus(observer,islands=[]){
    if(!observer||!Number.isFinite(observer.x)||!Number.isFinite(observer.z))return;
    this.focus={x:observer.x,z:observer.z};this.islands=islands;
    const current=prioritizeIslandLevels(observer,islands,this.quality,this.levels);
    const previous=this.levels;
    const wanted=new Map();
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    for(const {island,level} of current){
      if(!level||!this.registrations.has(island.name))continue;
      wanted.set(island.name,level);this.lastSeen.set(island.name,now);
      const timer=this.retireTimers.get(island.name);
      if(timer){clearTimeout(timer);this.retireTimers.delete(island.name);}
    }
    this.levels=wanted;
    this.activeKinds=new Set([...wanted.keys()].map(id=>this.registrations.get(id).kind));
    if([...wanted].some(([id,level])=>previous.get(id)!==level)||previous.size!==wanted.size)
      this.serial++;
    for(const {island,edge,level} of current){
      if(!level||!wanted.has(island.name))continue;
      const entry=this.registrations.get(island.name);
      this._applyLevel(island.name);
      this._requestForIsland({...entry,island},edge);
    }
    for(const id of previous.keys())if(!wanted.has(id)){
      const entry=this.registrations.get(id);
      const preview=entry&&this.loading.get(textureFile(entry.kind,'diff','low'));
      if(entry&&preview&&entry.material.map!==preview){
        entry.material.map=preview;entry.material.color.setScalar(1.65);
        entry.material.normalMap=this.quality==='quality'?this.neutralNormal:null;
        entry.material.needsUpdate=true;
        this.scheduleIdle(()=>this._pruneUnused());
      }
      this._retire(id);
    }
    if(this.queue.length)this._pump();
  }
  setQuality(quality){
    const tier=textureTier(quality);
    if(this.quality===quality&&this.tier===tier)return;
    this.quality=quality;this.tier=tier;this.serial++;
    // Avoid a late normal-map shader compilation on first island approach.
    for(const entry of this.registrations.values()){
      const normal=quality==='quality'?this.neutralNormal:null;
      if(entry.material.normalMap!==normal){entry.material.normalMap=normal;entry.material.needsUpdate=true;}
    }
    if(this.focus)this.updateFocus(this.focus,this.islands);
  }
}
