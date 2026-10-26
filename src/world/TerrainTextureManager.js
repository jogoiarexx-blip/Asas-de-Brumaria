import * as THREE from 'three';

/** Locally hosted Poly Haven CC0 textures with bounded asynchronous streaming.
 *
 * 1. Look ahead before a new island enters view.
 * 2. Download/decode a SINGLE map at a time, not five simultaneous 2K maps.
 * 3. Pre-upload one map during browser idle time (renderer.initTexture).
 * 4. Retain the existing painted terrain until the replacement is ready.
 * 5. Reuse maps during island-boundary crossings; delayed eviction prevents
 *    unload/reload thrash. Terrain physics and mesh geometry are untouched.
 */
export const TERRAIN_KINDS=Object.freeze(['meadow','beach','stone','ash','crystal']);
export const TERRAIN_TEXTURE_ROOT='./assets/textures/terrain/';
export function textureTier(quality){
  return quality==='quality'?'desktop':'mobile';
}
export function terrainKind(island){
  if(island?.biome==='ash')return 'ash';
  if(island?.biome==='crystal')return 'crystal';
  if(island?.name==='Atol Esquecido')return 'beach';
  if(island?.name==='Ilha do Farol'||island?.name==='Ilha da Névoa')return 'stone';
  return 'meadow';
}
export function textureFile(kind,channel,tier){
  if(!TERRAIN_KINDS.includes(kind)||!['diff','normal'].includes(channel)
    ||!['mobile','desktop'].includes(tier))throw Error('Unknown terrain PBR map');
  return `${TERRAIN_TEXTURE_ROOT}${kind}_${channel}_${tier}.webp`;
}

// Begin fetching well before the island enters the visible camera frustum.
// Hysteresis prevents churning while circling a coast or rapidly orbiting.
export const TERRAIN_STREAMING=Object.freeze({
  prefetchDistance:390,releaseDistance:545,evictionSeconds:18
});
export function desiredTerrainKinds(observer,islands,previous=new Set()){
  if(!observer||!Number.isFinite(observer.x)||!Number.isFinite(observer.z))
    return new Set(previous);
  const wanted=new Set();
  for(const island of islands){
    const kind=terrainKind(island);
    const dx=observer.x-island.x,dz=observer.z-island.z;
    const margin=previous.has(kind)?TERRAIN_STREAMING.releaseDistance
      :TERRAIN_STREAMING.prefetchDistance;
    if(dx*dx+dz*dz<Math.pow((island.r??0)+margin,2))wanted.add(kind);
  }
  return wanted;
}
const deferIdle=callback=>{
  if(typeof globalThis.requestIdleCallback==='function'){
    globalThis.requestIdleCallback(callback,{timeout:3500});
  }else{
    // Safari fallback. Exactly one upload per event-loop slice.
    setTimeout(()=>callback({didTimeout:true,timeRemaining:()=>8}),48);
  }
};

/** Scheduler accepts injectable loader/idle callbacks for reproducible tests.
 * GPU upload is never called inside the game's frame() render/update loop.
 */
export class TerrainTextureManager {
  constructor(renderer=null,{loader=null,idle=null}={}){
    this.renderer=renderer;
    this.materials=new Map();
    this.loader=loader??new THREE.TextureLoader();
    this.scheduleIdle=idle??deferIdle;
    this.loading=new Map(); // Resident maps only, no discarded pending promises.
    this.queue=[];this.queued=new Set();this.busy=false;
    this.tier=null;this.serial=0;this.failed=new Set();
    this.activeKinds=new Set(['meadow']);
    this.revision=new Map();
    this.lastSeen=new Map();
    this.idleEvictions=new Set();
    this.stats={requests:0,uploads:0,evictions:0,discarded:0};
  }
  register(kind,material){
    if(!TERRAIN_KINDS.includes(kind))throw Error('Unknown terrain kind');
    const group=this.materials.get(kind)??[];
    group.push(material);this.materials.set(kind,group);
    if(this.tier&&this.activeKinds.has(kind))this.requestKind(kind,this.tier);
  }
  _token(kind){return this.revision.get(kind)??0;}
  _invalidate(kind){this.revision.set(kind,this._token(kind)+1);}
  _valid(job){
    return this.activeKinds.has(job.kind)&&job.tier===this.tier
      &&job.token===this._token(job.kind);
  }
  _enqueue(kind,channel,tier,priority=0){
    const url=textureFile(kind,channel,tier),token=this._token(kind);
    if(this.queued.has(url)||this.loading.has(url))return;
    this.queued.add(url);
    this.queue.push({kind,channel,tier,url,token,priority});
    this.queue.sort((a,b)=>a.priority-b.priority);
    this._pump();
  }
  requestKind(kind,tier=this.tier,priority=0){
    if(!tier||!this.activeKinds.has(kind))return;
    const diff=textureFile(kind,'diff',tier);
    // Reuse resident maps without network and without another GPU upload.
    const resident=this.loading.get(diff);
    if(resident){
      this._attach(kind,'diff',resident,tier);
      if(tier==='desktop')this._enqueue(kind,'normal',tier,priority+1);
    }else this._enqueue(kind,'diff',tier,priority);
  }
  async _pump(){
    if(this.busy)return;
    this.busy=true;
    try{
      while(this.queue.length){
        const job=this.queue.shift();this.queued.delete(job.url);
        if(!this._valid(job)||this.loading.has(job.url))continue;
        let texture=null;
        try{
          this.stats.requests++;
          // TextureLoader's promise gives the browser time to fetch/decode.
          // Other 2K images are NOT requested concurrently.
          texture=await this.loader.loadAsync(job.url);
          texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
          texture.colorSpace=job.channel==='diff'
            ?THREE.SRGBColorSpace:THREE.NoColorSpace;
          texture.anisotropy=job.channel==='diff'?8:4;
          texture.generateMipmaps=true;
          texture.minFilter=THREE.LinearMipmapLinearFilter;
          texture.magFilter=THREE.LinearFilter;
        }catch(error){
          if(!this.failed.has(job.url)){
            this.failed.add(job.url);
            console.warn('[Terrain CC0] Procedural fallback for missing '+job.url,
              error?.message??error);
          }
          continue;
        }
        if(!this._valid(job)){texture.dispose();this.stats.discarded++;continue;}
        // Avoid a large first-use WebGL upload during flight. A single
        // prewarm is scheduled for the browser idle period.
        await new Promise(resolve=>this.scheduleIdle(deadline=>{
          if(!this._valid(job)){texture.dispose();this.stats.discarded++;resolve();return;}
          try{
            if(typeof this.renderer?.initTexture==='function'){
              this.renderer.initTexture(texture);
              this.stats.uploads++;
            }
          }catch(error){
            console.warn('[Terrain CC0] GPU prewarm unavailable; normal renderer fallback.',
              error?.message??error);
          }
          this.loading.set(job.url,texture);
          this._attach(job.kind,job.channel,texture,job.tier);
          resolve();
        }));
        // A high-resolution normal map is the last job: the diffuse has
        // already appeared, and one map is warmed/uploaded per idle slice.
        if(job.channel==='diff'&&job.tier==='desktop'&&this._valid(job))
          this._enqueue(job.kind,'normal',job.tier,job.priority+1);
      }
    }finally{this.busy=false;if(this.queue.length)this._pump();}
  }
  _attach(kind,channel,texture,tier){
    if(!this.activeKinds.has(kind)||this.tier!==tier)return;
    for(const material of this.materials.get(kind)??[]){
      if(channel==='diff'){
        if(material.map!==texture){
          material.map=texture;
          material.color.setScalar(texture?1.65:1);
          material.needsUpdate=true;
        }
      }else if(material.normalMap!==texture){
        material.normalMap=texture;material.needsUpdate=true;
      }
    }
  }
  releaseKind(kind){
    this._invalidate(kind);
    for(const material of this.materials.get(kind)??[]){
      if(material.map||material.normalMap){
        material.map=null;material.normalMap=null;
        material.color.setScalar(1);material.needsUpdate=true;
      }
    }
    for(const [url,texture] of this.loading){
      if(!url.includes('/'+kind+'_'))continue;
      this.loading.delete(url);texture.dispose();this.stats.evictions++;
    }
  }
  // Called at the existing 0.24 s world-detail cadence, not every render.
  updateFocus(observer,islands=[]){
    if(!observer||!Number.isFinite(observer.x)||!Number.isFinite(observer.z))return;
    const wanted=desiredTerrainKinds(observer,islands,this.activeKinds);
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    for(const kind of wanted)this.lastSeen.set(kind,now);
    const previous=this.activeKinds;
    if(previous.size===wanted.size&&[...wanted].every(k=>previous.has(k)))return;
    this.activeKinds=wanted;
    this.serial++;
    for(const kind of wanted){
      if(!previous.has(kind)){
        this._invalidate(kind);
        const distance=Math.min(...islands.filter(i=>terrainKind(i)===kind)
          .map(i=>Math.hypot(observer.x-i.x,observer.z-i.z)));
        this.requestKind(kind,this.tier,distance);
      }
    }
    for(const kind of previous)if(!wanted.has(kind)){
      this._invalidate(kind);
      if(this.idleEvictions.has(kind))continue;
      this.idleEvictions.add(kind);
      // Keep decoded textures resident for 18 s so sharp turns never re-fetch.
      this.scheduleIdle(()=>{
        this.idleEvictions.delete(kind);
        const seen=this.lastSeen.get(kind)??0;
        const age=(typeof performance!=='undefined'?performance.now():Date.now())-seen;
        if(!this.activeKinds.has(kind)&&age>=TERRAIN_STREAMING.evictionSeconds*1000)
          this.releaseKind(kind);
        else if(!this.activeKinds.has(kind)){
          setTimeout(()=>{if(!this.activeKinds.has(kind))this.releaseKind(kind);},
            Math.max(0,TERRAIN_STREAMING.evictionSeconds*1000-age));
        }
      });
    }
  }
  setQuality(quality){
    const tier=textureTier(quality);
    if(this.tier===tier)return;
    this.tier=tier;this.serial++;
    for(const kind of this.activeKinds){
      this._invalidate(kind);
      // Keep current photo visible until the next tier is prewarmed.
      // Prevents a flash of untextured terrain when quality changes.
      this.requestKind(kind,tier);
    }
  }
}
