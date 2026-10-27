import {visibleIslandFoliage} from './VisibilityBudget.js';

/** Island-scoped, incremental visual resource scheduler.
 * No terrain, collisions, quests, enemy state or save data is altered here.
 * The budget is one mesh batch per frame; inactive batches can be reused. */
export const ISLAND_DETAIL_PHASES=Object.freeze(['coast','foliage','grass','flowers']);
export const ISLAND_STREAM_BUDGET=Object.freeze({jobsPerFrame:1,residentIslands:4});

export function islandShoreDistance(observer,island){
  if(!observer||!Number.isFinite(observer.x)||!Number.isFinite(observer.z))return Infinity;
  return Math.max(0,Math.hypot(observer.x-island.x,observer.z-island.z)-island.r);
}

export function rankIslandDetail(observer,tier,islands,loaded=new Set()){
  return islands.filter(island=>visibleIslandFoliage(observer,island,tier,loaded.has(island.name)))
    .map(island=>({island,distance:islandShoreDistance(observer,island)}))
    .sort((a,b)=>a.distance-b.distance);
}

export class IslandDetailStream {
  constructor(islands,builders,{phases=ISLAND_DETAIL_PHASES,maxResident=ISLAND_STREAM_BUDGET.residentIslands}={}){
    this.islands=islands;
    this.builders=builders;
    this.phases=phases;
    this.maxResident=maxResident;
    this.resident=new Map();
    this.lastUsed=new Map();
    this.wanted=new Set();
    this.queue=[];
    this.tick=0;
    this.stats={jobs:0,reused:0,evicted:0,peakResident:0};
  }
  markReady(name,phases=this.phases){
    const done=this.resident.get(name)??new Set();
    for(const phase of phases)done.add(phase);
    this.resident.set(name,done);
    this.lastUsed.set(name,++this.tick);
    this.stats.peakResident=Math.max(this.stats.peakResident,this.resident.size);
  }
  plan(observer,tier){
    const ranked=rankIslandDetail(observer,tier,this.islands,new Set(this.resident.keys()));
    this.wanted=new Set(ranked.map(item=>item.island.name));
    const jobs=[];
    const required=tier==='economy'?this.phases.filter(phase=>phase!=='flowers'):this.phases;
    for(const {island,distance} of ranked){
      const done=this.resident.get(island.name);
      if(required.every(phase=>done?.has(phase))){
        this.lastUsed.set(island.name,++this.tick);this.stats.reused++;
        continue;
      }
      for(const phase of required)if(!done?.has(phase)){
        jobs.push({island,phase,distance});
      }
    }
    this.queue=jobs.sort((a,b)=>a.distance-b.distance || this.phases.indexOf(a.phase)-this.phases.indexOf(b.phase));
    return {wanted:this.wanted.size,pending:this.queue.length};
  }
  step(max=ISLAND_STREAM_BUDGET.jobsPerFrame){
    let completed=0;
    while(completed<max&&this.queue.length){
      const item=this.queue.shift();
      if(!this.wanted.has(item.island.name))continue;
      if(this.resident.get(item.island.name)?.has(item.phase))continue;
      const build=this.builders[item.phase];
      if(typeof build!=='function')throw new Error('Unknown island detail phase: '+item.phase);
      build(item.island);
      this.markReady(item.island.name,[item.phase]);
      this.stats.jobs++;completed++;
    }
    this.trim();
    return completed;
  }
  /** Evict LRU only outside the visible area; never downgrade an active island. */
  trim(){
    while(this.resident.size>this.maxResident){
      const candidates=[...this.resident.keys()].filter(id=>!this.wanted.has(id));
      if(!candidates.length)break;
      candidates.sort((a,b)=>(this.lastUsed.get(a)??0)-(this.lastUsed.get(b)??0));
      const id=candidates[0],island=this.islands.find(i=>i.name===id);
      for(const phase of this.resident.get(id))this.builders.dispose?.(island,phase);
      this.resident.delete(id);this.lastUsed.delete(id);this.stats.evicted++;
    }
  }
  get pending(){return this.queue.length;}
  get residentCount(){return this.resident.size;}
}
