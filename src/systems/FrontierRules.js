import {stretchMarkerOnIsland} from '../world/IslandLayout.js';
// Two optional encounters, independent of the original seven missions.
// Fixed identifiers preserve checkpoints even when visual assets are updated.
export const FRONTIER_ZONES=Object.freeze([
  Object.freeze({
    id:'crystal',name:'Arquipélago dos Cristais',
    guardian:'Guardião de Quartzo',x:-480,z:142.5,
    color:0x65e5fd,accent:0xa6ffff,reward:2,guardianReward:2,
    // Deliberately within the existing 54 m island radius.
    markers:Object.freeze([[-340,83],[-315,119],[-294,89]].map(point=>Object.freeze(stretchMarkerOnIsland(point,'Arquipélago dos Cristais'))))
  }),
  Object.freeze({
    id:'ash',name:'Ilha das Cinzas',
    guardian:'Sentinela de Basalto',x:498,z:-165,
    color:0xf7a77a,accent:0xffd59c,reward:3,guardianReward:2,
    markers:Object.freeze([[309,-126],[357,-111],[333,-86]].map(point=>Object.freeze(stretchMarkerOnIsland(point,'Ilha das Cinzas'))))
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

/** Optional local guidance. It never takes over story navigation outside of
 * the player's currently visited frontier island, and ignores completed goals.
 * Works with snapshots, so it does not depend on Three.js or renderer state.
 */
export function nearestFrontierObjective(position,{found=[],defeated=[],
  combatUnlocked=false,radius=125}={}){
 if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z))return null;
 const foundSet=found instanceof Set?found:new Set(found);
 const defeatedSet=defeated instanceof Set?defeated:new Set(defeated);
 let selected=null;
 let nearestZoneDistance=Infinity;
 for(const zone of FRONTIER_ZONES){
  const distance=Math.hypot(position.x-zone.x,position.z-zone.z);
  if(distance>radius||distance>=nearestZoneDistance)continue;
  let candidate=null,bestDistance=Infinity;
  for(let i=0;i<zone.markers.length;i++){
   const id=markerId(zone,i);
   if(foundSet.has(id))continue;
   const [x,z]=zone.markers[i];
   const d=Math.hypot(position.x-x,position.z-z);
   if(d<bestDistance){bestDistance=d;candidate={id,kind:'relic',x,z,
     zone:zone.id,name:zone.name,label:zone.id==='crystal'?'Fragmento de Quartzo':'Brasa Antiga',
     remaining:zone.markers.filter((_,j)=>!foundSet.has(markerId(zone,j))).length};}
  }
  if(!candidate&&combatUnlocked&&!defeatedSet.has(zone.id)){
   candidate={id:zone.id+':guardian',kind:'guardian',x:zone.x+4,z:zone.z-7,
     zone:zone.id,name:zone.name,label:zone.guardian,remaining:1};
  }
  if(candidate){selected=candidate;nearestZoneDistance=distance;}
 }
 return selected;
}
