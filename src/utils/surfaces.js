import {obstacleCandidates} from './ObstacleGrid.js';
import {obstacleBlocks,overlapsCircle} from './collision.js';

/** Gently flatten village terrain so the platform never buries its own base or floats
 * several metres above the hillside. The same function is used for terrain vertices
 * and gameplay height queries, preventing the rendering/collision mismatch.
 */
export function flattenVillageGround(rawY,x,z,plateauY,{cx=8,cz=7,flatRadius=9,blendRadius=17}={}) {
  const d=Math.hypot(x-cx,z-cz);
  if(d<=flatRadius)return plateauY;
  if(d>=blendRadius)return rawY;
  const t=(d-flatRadius)/(blendRadius-flatRadius);
  const smooth=t*t*(3-2*t);
  return plateauY*(1-smooth)+rawY*smooth;
}

/** Support uses the actor's footprint radius, not just its center; otherwise the
 * body visibly falls into the rim while the feet are still over the platform.
 */
export function surfaceHeightAt(terrainY,x,z,surfaces=[],bodyRadius=0) {
  let height=terrainY;
  for(const surface of surfaces){
    const dx=x-surface.x,dz=z-surface.z;
    if(dx*dx+dz*dz<=(surface.radius+Math.max(0,bodyRadius))**2){
      height=Math.max(height,surface.top);
    }
  }
  return height;
}

/** Find a clear nearby dismount position instead of placing the rider inside a prop. */
export function safeDismountSpot(origin,{obstacles=[],walkable=()=>true,groundAt=()=>0,radius=.52,maxHeightDelta=1.6}={}) {
  const originHeight=groundAt(origin.x,origin.z);
  const candidates=obstacleCandidates(obstacles,origin.x-5.3-radius,origin.z-5.3-radius,
    origin.x+5.3+radius,origin.z+5.3+radius);
  for(const distance of [2.8,4,5.3]){
    for(let index=0;index<12;index++){
      const angle=Math.PI/4+index*Math.PI/6;
      const x=origin.x+Math.cos(angle)*distance;
      const z=origin.z+Math.sin(angle)*distance;
      if(!walkable(x,z))continue;
      const ground=groundAt(x,z);
      if(!Number.isFinite(ground)||Math.abs(ground-originHeight)>maxHeightDelta)continue;
      const blocked=candidates.some(o=>obstacleBlocks(o,ground+1.1,1.1)&&overlapsCircle(x,z,radius,o));
      if(!blocked)return {x,z,y:ground};
    }
  }
  return null;
}
