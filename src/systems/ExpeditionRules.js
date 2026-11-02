/** Side campaign state, deliberately independent of the seven-story-mission save. */
// The gate sits at the eastern tip of the final archipelago island (Cinzas).
// The mountain chunk starts at x>650; keep the gate and shoreline on the first map.
export const MOUNTAIN_PORTAL=Object.freeze({
  x:633,z:-192.5,y:44,loadRadius:165,enterRadius:16,unloadRadius:215,exitAt:752,
  returnX:603,returnZ:-192.5
});
export const MOUNTAIN_ENTRY=Object.freeze({x:798,z:35,y:51});
export const BOAT_POSITIONS=Object.freeze([[898,7,-90],[1050,7,143],[1206,7,-112]]);
export const GIANT_DRAGON_POSITION=Object.freeze({x:1120,y:79,z:8});
const clamp=(value,lo,hi,fallback=hi)=>Number.isFinite(value)?Math.max(lo,Math.min(hi,Math.floor(value))):fallback;
export function normalizeExpedition(data){
 const boatHealth=Array.from({length:3},(_,i)=>clamp(data?.boatHealth?.[i],0,2,2));
 const bossHealth=clamp(data?.bossHealth,0,12,12);
 const allBoats=boatHealth.every(h=>h===0);
 const phase=!allBoats?'boats':bossHealth>0?'boss':data?.rewarded===true?'complete':'return';
 return {boatHealth,bossHealth,phase,rewarded:phase==='complete',inRegion:data?.inRegion===true&&phase!=='complete'};
}
export class ExpeditionProgress {
 constructor(data){Object.assign(this,normalizeExpedition(data));}
 get boatsSunk(){return this.boatHealth.filter(v=>v===0).length;}
 hitBoat(index){
   if(this.phase!=='boats'||!Number.isInteger(index)||index<0||index>2||this.boatHealth[index]===0)return {hit:false,sunk:false};
   this.boatHealth[index]--;const sunk=this.boatHealth[index]===0;
   if(this.boatsSunk===3)this.phase='boss';
   return {hit:true,sunk,phase:this.phase};
 }
 hitBoss(amount=1){
   if(this.phase!=='boss')return {hit:false,defeated:false};
   const damage=Number.isFinite(amount)?Math.max(1,Math.min(2,Math.floor(amount))):1;
   this.bossHealth=Math.max(0,this.bossHealth-damage);const defeated=this.bossHealth<=0;
   if(defeated)this.phase='return';
   return {hit:true,defeated,phase:this.phase};
 }
 completeReturn(){if(this.phase!=='return')return false;this.phase='complete';this.rewarded=true;this.inRegion=false;return true;}
 snapshot(){return {boatHealth:[...this.boatHealth],bossHealth:this.bossHealth,phase:this.phase,rewarded:this.rewarded,inRegion:this.inRegion};}
}
const horizontalPortalDistance=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)
 ?Math.hypot(p.x-MOUNTAIN_PORTAL.x,p.z-MOUNTAIN_PORTAL.z):Infinity;
const withinGateHeight=p=>Number.isFinite(p?.y)&&Math.abs(p.y-MOUNTAIN_PORTAL.y)<=24;
/** Preload only when approaching the visible gate, never anywhere else on the eastern map. */
export const shouldLoadMountain=(p,riding=false)=>Boolean(riding)&&p?.y>14&&
 horizontalPortalDistance(p)<MOUNTAIN_PORTAL.loadRadius&&p.x<=650;
export const shouldEnterMountain=(p,riding=false)=>Boolean(riding)&&withinGateHeight(p)&&
 horizontalPortalDistance(p)<=MOUNTAIN_PORTAL.enterRadius&&p.x<=650;
export const shouldExitMountain=(p,riding=false)=>Boolean(riding)&&p?.x<MOUNTAIN_PORTAL.exitAt&&p.x>650;
/** A slow hold at the actual ring avoids crossing before the async chunk is ready. */
export function shouldHoldMountainGate(p,riding=false,unlocked=false,loaded=false){
 return Boolean(riding&&unlocked&&!loaded&&shouldEnterMountain(p,true));
}
export const shouldUnloadMountain=(p)=>horizontalPortalDistance(p)>MOUNTAIN_PORTAL.unloadRadius;
