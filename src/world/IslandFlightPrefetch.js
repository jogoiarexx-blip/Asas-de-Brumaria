import {islandShoreDistance} from './IslandDetailStream.js';

export const FLIGHT_PREFETCH=Object.freeze({lookAheadSeconds:6,maxDistance:310,minSpeed:15,maxAngleCos:.66});
/** Choose one island ahead of the dragon; never request behind it or while
 * grounded. Terrain and collision remain present regardless of this hint. */
export function predictFlightIsland(position,direction,speed,islands,config=FLIGHT_PREFETCH){
  if(!position||!direction||!Number.isFinite(speed)||speed<config.minSpeed)return null;
  const length=Math.hypot(direction.x,direction.z);
  if(length<.2)return null;
  const ux=direction.x/length,uz=direction.z/length;
  const lookahead=Math.min(config.maxDistance,Math.max(100,speed*config.lookAheadSeconds));
  const predicted={x:position.x+ux*lookahead,z:position.z+uz*lookahead};
  let result=null,best=Infinity;
  for(const island of islands){
    const dx=island.x-position.x,dz=island.z-position.z,d=Math.hypot(dx,dz);
    if(d<island.r+15||d<1)continue;
    const facing=(dx*ux+dz*uz)/d;
    if(facing<config.maxAngleCos)continue;
    if(d-island.r>lookahead+island.r*.55+85)continue;
    const remaining=islandShoreDistance(predicted,island);
    const score=remaining+(1-facing)*100;
    if(score<best){best=score;result=island;}
  }
  return result;
}
