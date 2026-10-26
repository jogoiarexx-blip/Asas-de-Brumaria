// Two optional encounters, independent of the original seven missions.
// Fixed identifiers preserve checkpoints even when visual assets are updated.
export const FRONTIER_ZONES=Object.freeze([
  Object.freeze({
    id:'crystal',name:'Arquipélago dos Cristais',
    guardian:'Guardião de Quartzo',x:-320,z:95,
    color:0x65e5fd,accent:0xa6ffff,reward:2,guardianReward:2,
    // Deliberately within the existing 54 m island radius.
    markers:Object.freeze([[-340,83],[-315,119],[-294,89]])
  }),
  Object.freeze({
    id:'ash',name:'Ilha das Cinzas',
    guardian:'Sentinela de Basalto',x:332,z:-110,
    color:0xf7a77a,accent:0xffd59c,reward:3,guardianReward:2,
    markers:Object.freeze([[309,-126],[357,-111],[333,-86]])
  })
]);
export function markerId(zone,index){return zone.id+':'+index;}
export const FRONTIER_MARKERS=Object.freeze(FRONTIER_ZONES.flatMap(zone=>
  zone.markers.map((pos,i)=>markerId(zone,i))));
export function normalizeFrontier(saved){
 const found=new Set(Array.isArray(saved?.found)?saved.found:[]);
 const defeated=new Set(Array.isArray(saved?.defeated)?saved.defeated:[]);
 const rewarded=new Set(Array.isArray(saved?.rewarded)?saved.rewarded:[]);
 return {
  found:FRONTIER_MARKERS.filter(id=>found.has(id)),
  defeated:FRONTIER_ZONES.filter(z=>defeated.has(z.id)).map(z=>z.id),
  rewarded:FRONTIER_ZONES.filter(z=>rewarded.has(z.id)).map(z=>z.id)
 };
}
export function frontierVisible(observer,zone,wasVisible=false){
 if(!observer)return false;
 const dx=observer.x-zone.x,dz=observer.z-zone.z;
 const radius=205+(wasVisible?25:0);
 return dx*dx+dz*dz<=radius*radius;
}
export function frontierClaimable(dragon,position,radius=8.5){
 if(!dragon?.riding||!dragon?.airborne)return false;
 const p=dragon.group?.position;
 if(!p||!position)return false;
 return Math.hypot(p.x-position.x,p.y-position.y,p.z-position.z)<=radius;
}
